import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Alert, AppState, AppStateStatus, Platform } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import { logoutService } from '../services/logoutService';
import { accountDeletionService } from '../services/accountDeletionService';
import type { User, AuthContextProps, Gym } from '../types/auth';
import { DataMapper } from '../utils/dataMapper';

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

const SESSION_EXPIRY_KEY = "auth_expiry";
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days
const USER_STORAGE_KEY = "auth_user"; // Align with common naming

export const mapProfile = (rawData: any, email: string): User => {
  const userData = DataMapper.fromDb<any>(rawData); // Ensure all keys are camelCase

  const accountStatus = (userData.status || 'active').toLowerCase();

  // STRICT SSOT: Define calibration based on primary columns
  // Centimeter Guard: 1.75 -> 175
  const h_raw = Number(userData.height);
  const h = (h_raw > 0 && h_raw < 3) ? h_raw * 100 : h_raw;
  const w = Number(userData.weight);
  const a = Number(userData.age);
  const g = userData.gender;
  const goal = (userData.goal || userData.primaryObjective);

  const isCalibrated = Boolean(
    h > 0 &&
    w > 0 &&
    a > 0 &&
    g &&
    goal
  );

  const firstNameFallback = userData.firstName || (userData.name?.includes(' ') ? userData.name.split(' ')[0] : null);
  const nameFallback = userData.name || (userData.firstName ? `${userData.firstName} ${userData.lastName || ''}`.trim() : email.split('@')[0]);

  return {
    id: userData.id,
    email: userData.email || email,
    name: nameFallback,
    firstName: firstNameFallback,
    lastName: userData.lastName,
    role: userData.role || 'member',
    status: accountStatus,
    membershipStatus: userData.membershipStatus || 'New',
    avatarUrl: userData.avatarUrl,
    phone: userData.phone,
    // No metadata fallbacks for biometrics
    goal: userData.goal || userData.primaryObjective,
    gender: userData.gender,
    dob: userData.dob,
    height: (Number(userData.height) > 0 && Number(userData.height) < 3) ? Number(userData.height) * 100 : userData.height,
    weight: userData.weight,
    age: userData.age,
    targetWeight: userData.targetWeight,
    recommendedWeight: userData.recommendedWeight,
    goalTimeframe: userData.goalTimeframe,
    uniqueId: userData.uniqueId || userData.unique_id || userData.uniqueid,
    createdAt: userData.createdAt || userData.created_at || userData.createdat,
    renewalDueDate: userData.renewalDueDate || userData.renewal_due_date || userData.renewalduedate,
    weightLost: userData.weightLost || userData.weight_lost || userData.weightlost,
    membershipType: userData.membershipType || userData.membership_type || userData.membershiptype,
    workoutIntensity: userData.workoutIntensity || userData.workout_intensity || userData.workoutintensity,
    calculatedBmi: userData.calculatedBmi || userData.calculated_bmi || userData.calculatedbmi,
    isCalibrated,
    // ── Multi-tenant fields ──────────────────────────────────
    gymId: userData.gymId || userData.gym_id || userData.gymid || null,
    gymUniqueId: userData.gymUniqueId || userData.gym_unique_id || userData.gymuniqueid || null,
    accessMode: userData.accessMode || userData.access_mode || userData.accessmode || null,
    crmTag: userData.crmTag || userData.crm_tag || userData.crmtag || null,
  };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentGym, setCurrentGym] = useState<Gym | null>(null);
  const [approvalResetTrigger, setApprovalResetTrigger] = useState(0);
  const logoutInProgress = React.useRef(false);
  const loginInProgress = React.useRef(false);
  const authOperationInProgress = React.useRef(false);
  const userRef = React.useRef<User | null>(null);
  userRef.current = user;

  const fetchGym = async (gymId: string): Promise<Gym | null> => {
    try {
      const { data, error } = await (supabase as any)
        .from('gyms')
        .select('*')
        .eq('id', gymId)
        .maybeSingle();
      if (error || !data) return null;
      return DataMapper.fromDb<Gym>(data);
    } catch {
      return null;
    }
  };

  const fetchProfile = async (userId: string, email: string) => {
    try {
      console.log('[useAuth] Fetching profile for:', userId);

      // 1. Fetch User Profile
      const profilePromise = (supabase as any)
        .from('users')
        .select(`
          *, 
          height, 
          weight, 
          age, 
          gender, 
          goal, 
          primary_objective, 
          target_weight, 
          recommended_weight, 
          goal_timeframe, 
          unique_id,
          membership_status
        `)
        .eq('id', userId)
        .maybeSingle();

      // 2. Fetch Active Subscription (Source of Truth)
      const subPromise = (supabase as any)
        .from('subscriptions')
        .select('status, ends_at')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gt('ends_at', new Date().toISOString())
        .order('ends_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Execute in parallel with 10s timeout — prevents login hang if DB is slow
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timed out')), 10000)
      );
      const [profileResult, subResult] = await Promise.race([
        Promise.all([profilePromise, subPromise]),
        timeoutPromise
      ]) as any;

      const { data: userData, error: profileErr } = profileResult;
      const { data: subDataRaw } = subResult; // Error here is non-critical
      const subData = DataMapper.fromDb(subDataRaw);

      if (profileErr) throw profileErr;

      if (userData) {
        let profile = mapProfile(userData, email);

        // Do NOT override membership_status from subscription — membership table is SSOT for access gate.

        if (profile.status === 'suspended') {
          console.warn('[useAuth] User is suspended, forcing logout');
          await logout();
          return null;
        }

        // Fetch gym in background (non-blocking)
        if (profile.gymId) {
          fetchGym(profile.gymId).then(gym => {
            if (gym) setCurrentGym(gym);
          });
        }

        return profile;
      }
      return null;
    } catch (err) {
      console.error('[useAuth] fetchProfile error:', err);
      return null;
    }
  };

  /** Restore persisted Supabase session on app startup. Uses storage from createClient (AsyncStorage on native). */
  const loadSession = async () => {
    try {
      console.log('[useAuth] Loading session...');

      if (logoutInProgress.current) {
        console.log('[useAuth] Logout in progress — skipping session load');
        setLoading(false);
        return;
      }

      // Fetch session from Supabase with timeout
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Session fetch timeout')), 5000)
      );

      let session: any = null;
      try {
        const result = await Promise.race([sessionPromise, timeoutPromise]) as any;
        session = result.data?.session;
        if (result.error) throw result.error;
      } catch (netErr: any) {
        console.warn('[useAuth] Network session fetch failed, falling back to cache:', netErr.message);

        // Use cache immediately so user isn't stuck, then fetch fresh profile in background
        const cached = await AsyncStorage.getItem(USER_STORAGE_KEY);
        if (cached && !logoutInProgress.current) {
          const cachedUser = JSON.parse(cached);
          const reMapped = mapProfile(cachedUser, cachedUser.email || "");
          setUser({ ...cachedUser, ...reMapped });
          // Fetch fresh profile in background — avoids lockout when DB says Active but cache says pending
          fetchProfile(cachedUser.id || cachedUser.userId, cachedUser.email || "").then(
            (fresh) => {
              if (fresh && !logoutInProgress.current) {
                setUser(fresh);
                AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(fresh));
                const s = (fresh.membershipStatus || '').toLowerCase();
                if (s === 'active' || s === 'approved') triggerApprovalReset();
              }
            }
          ).catch(() => {});
        }
        setLoading(false);
        return;
      }

      if (logoutInProgress.current) return;

      if (session?.user) {
        console.log('[useAuth] Session found for:', session.user.id);
        const profile = await fetchProfile(session.user.id, session.user.email || "");
        if (logoutInProgress.current) return;
        if (profile) {
          setUser(profile);
          await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(profile));
        } else {
          console.log('[useAuth] Profile missing, using auth fallback');
          const fallbackUser: User = {
            id: session.user.id,
            email: session.user.email || "",
            name: session.user.email?.split('@')[0] || "User",
            role: 'member',
            status: 'active',
            membershipStatus: 'New',
            isCalibrated: false
          };
          setUser(fallbackUser);
          await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(fallbackUser));
        }
      } else {
        console.log('[useAuth] No session found');
        setUser(null);
        await AsyncStorage.removeItem(USER_STORAGE_KEY);
      }
    } catch (err: any) {
      console.warn('[useAuth] Session load issue:', err.message);

      const isTokenError =
        err.message?.includes('Refresh Token') ||
        err.message?.includes('Invalid') ||
        err.name === 'AuthApiError';

      if (isTokenError) {
        console.warn('[useAuth] Bad token detected — clearing auth storage to prevent loop');
        setUser(null);
        await AsyncStorage.removeItem(USER_STORAGE_KEY).catch(() => {});
        await AsyncStorage.removeItem(SESSION_EXPIRY_KEY).catch(() => {});
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
          const lsKeys: string[] = [];
          for (let i = 0; i < window.localStorage.length; i++) {
            const k = window.localStorage.key(i);
            if (k && (k.startsWith('sb-') || k.includes('auth-token'))) lsKeys.push(k);
          }
          lsKeys.forEach((k) => window.localStorage.removeItem(k));
        }
        await supabase.auth.signOut().catch(() => {});
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[useAuth] Auth event: ${event}, loginInProgress: ${loginInProgress.current}, logoutInProgress: ${logoutInProgress.current}`);

      if (logoutInProgress.current) {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setCurrentGym(null);
          await AsyncStorage.multiRemove([USER_STORAGE_KEY, SESSION_EXPIRY_KEY]).catch(() => {});
        }
        return;
      }

      // login() or explicit auth flow (signIn/signUp) handles setUser — don't compete.
      if (loginInProgress.current || authOperationInProgress.current) {
        console.log('[useAuth] onAuthStateChange skipped — auth flow in progress');
        return;
      }

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setCurrentGym(null);
        await AsyncStorage.multiRemove([USER_STORAGE_KEY, SESSION_EXPIRY_KEY]).catch(() => {});
        return;
      }

      // CRITICAL: Skip profile fetching during password recovery
      // Recovery sessions should not trigger user profile updates - they're temporary
      // and fetching profile can interfere with password reset flow
      const isInPasswordReset = (global as any).__inPasswordReset;
      if (event === 'PASSWORD_RECOVERY' || isInPasswordReset) {
        console.log('[useAuth] Password recovery detected - skipping profile fetch to preserve recovery session', { event, isInPasswordReset });
        return;
      }

      if (session?.user) {
        const profile = await fetchProfile(session.user.id, session.user.email || "");
        if (logoutInProgress.current || loginInProgress.current || authOperationInProgress.current) return;
        if (profile) {
          setUser(profile);
          await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(profile));
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const beginAuthOperation = () => {
    authOperationInProgress.current = true;
  };

  const endAuthOperation = () => {
    authOperationInProgress.current = false;
  };

  const login = async (u: User) => {
    loginInProgress.current = true;
    setLoading(true);
    try {
      console.log('[useAuth] Login triggered, fetching full profile before unblocking navigator...');
      const fullProfile = await fetchProfile(u.id, u.email);
      const finalUser = fullProfile || u;
      setUser(finalUser);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(finalUser));
    } catch (err) {
      console.error('[useAuth] login() profile fetch failed, using caller-provided data:', err);
      setUser(u);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(u));
    } finally {
      loginInProgress.current = false;
      authOperationInProgress.current = false;
      setLoading(false);
    }
  };

  const logout = async () => {
    logoutInProgress.current = true;
    try {
      await logoutService.performLogout(setUser, setCurrentGym);
    } catch (error) {
      console.error("[useAuth] Logout error:", error);
      setUser(null);
      setCurrentGym(null);
    } finally {
      logoutInProgress.current = false;
    }
  };

  const deleteAccount = async (): Promise<{ success: boolean; message: string }> => {
    const u = userRef.current;
    if (!u?.id) return { success: false, message: 'No user logged in.' };
    logoutInProgress.current = true;
    try {
      const result = await accountDeletionService.requestAccountDeletion(u.id, setUser, setCurrentGym);
      return result;
    } finally {
      logoutInProgress.current = false;
    }
  };

  const refreshUser = async () => {
    const u = userRef.current;
    if (!u?.id || logoutInProgress.current) return;
    try {
      const updatedProfile = await fetchProfile(u.id, u.email || '');
      if (logoutInProgress.current) return;
      if (updatedProfile) {
        setUser(updatedProfile);
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedProfile));
        const status = (updatedProfile.membershipStatus || '').toLowerCase();
        if (status === 'active' || status === 'approved') triggerApprovalReset();
      }
    } catch (error) {
      console.error("[useAuth] Error refreshing user:", error);
    }
  };

  const mergeUserData = (partial: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const merged = { ...prev, ...partial };
      AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(merged)).catch(() => {});
      return merged;
    });
  };

  const triggerApprovalReset = () => setApprovalResetTrigger(n => n + 1);

  const refreshUserWithDiagnostics = async () => {
    const u = userRef.current;
    if (!u?.id) return { success: false, error: 'No user id' };
    try {
      const profilePromise = (supabase as any)
        .from('users')
        .select('*, height, weight, age, gender, goal, primary_objective, target_weight, recommended_weight, goal_timeframe, unique_id, membership_status')
        .eq('id', u.id)
        .maybeSingle();
      const subPromise = (supabase as any)
        .from('subscriptions')
        .select('status, ends_at')
        .eq('user_id', u.id)
        .eq('status', 'active')
        .gt('ends_at', new Date().toISOString())
        .order('ends_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const [profileResult, subResult] = await Promise.all([profilePromise, subPromise]) as any;
      const { data: userData, error: profileErr } = profileResult;
      const { data: subDataRaw, error: subErr } = subResult;
      if (profileErr) return { success: false, error: profileErr?.message || String(profileErr), profileErr, subErr };
      if (!userData) return { success: false, error: 'No profile row (RLS?)', rawProfile: null, rawSub: subDataRaw, profileErr, subErr };
      let profile = mapProfile(userData, u.email || '');
      const subData = DataMapper.fromDb(subDataRaw);
      if (subData) profile = { ...profile, membershipStatus: 'Active' };
      setUser(profile);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(profile));
      const status = (profile.membershipStatus || '').toLowerCase();
      if (status === 'active' || status === 'approved') triggerApprovalReset();
      return { success: true, profile, rawProfile: userData, rawSub: subDataRaw, profileErr, subErr };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err), profileErr: err, subErr: undefined };
    }
  };

  // Real-time listeners
  useEffect(() => {
    if (!user?.id) return;

    // PRIMARY: users table. When admin approves, users.membership_status → 'Active'.
    const profileChannel = supabase
      .channel(`users_row_${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${user.id}` },
        async (payload) => {
          if (logoutInProgress.current) return;
          console.log('[useAuth] Real-time profile update');
          const uData = payload.new as any;

          const remapped = mapProfile(uData, user.email);
          const updatedUser: User = {
            ...user,
            ...remapped,
            createdAt: user.createdAt,
          };

          if (logoutInProgress.current) return;
          setUser(updatedUser);
          await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
          const status = (remapped.membershipStatus || '').toLowerCase();
          if (status === 'active' || status === 'approved') triggerApprovalReset();
        }
      )
      .subscribe();

    // BACKUP: payments table. If GMS approves payment and a trigger updates users,
    // we may get payment UPDATE first. Refresh fetches users.membership_status.
    // NOTE: Only user_id is reliable; member_id may store a different ID.
    const paymentChannel = supabase
      .channel(`payments_user_${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'payments', filter: `user_id=eq.${user.id}` },
        () => { if (!logoutInProgress.current) refreshUser(); }
      )
      .subscribe();

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && !logoutInProgress.current) {
        refreshUser();
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(paymentChannel);
      appStateSubscription.remove();
    };
  }, [user?.id]);

  const isAdmin = user?.role === 'admin';
  const isMember = user?.role === 'member';
  // SINGLE SOURCE OF TRUTH: users.membership_status from DB. Gate switches when this is Active.
  // ── SSOT: users.membership_status from DB → user.membershipStatus in app ───
  // When admin approves, DB sets membership_status = 'Active'. fetchProfile reads it.
  const dbMembershipStatus = (user?.membershipStatus || '').toLowerCase();
  const isMembershipActive = dbMembershipStatus === 'active' || dbMembershipStatus === 'approved';
  const isActiveMember = isMembershipActive;
  const isPendingRejected = dbMembershipStatus === 'pending' || dbMembershipStatus === 'rejected';

  const isGymMember = user?.accessMode === 'gym_access';
  const isEventMember = user?.accessMode === 'event_access';
  const isPlatformAdmin = user?.role === 'platform_admin';

  const hasGymMapping = Boolean(user?.gymId && user?.accessMode);
  const hasValidMemberId = Boolean(user?.uniqueId && user.uniqueId.length > 0);

  // Approval gate: gym_access requires users.membership_status = 'Active'.
  // Event_access: always approved (ID issued immediately).
  const isApprovedForCalibration = Boolean(
    user?.accessMode === 'event_access' ||
    (user?.accessMode === 'gym_access' && isMembershipActive)
  );

  // ── DERIVED CALIBRATION FLAG (The absolute gate) ────────────────
  const isCalibrated = Boolean(
    user &&
    Number(user.height) > 0 &&
    Number(user.weight) > 0 &&
    Number(user.age) > 0 &&
    user.gender &&
    user.goal
  );

  // ══════════════════════════════════════════════════════════════════════════════
  // SECURITY: Fully Onboarded Check — all gates must pass (including approval)
  // ══════════════════════════════════════════════════════════════════════════════
  const isFullyOnboarded = Boolean(user && hasGymMapping && hasValidMemberId && isApprovedForCalibration && isCalibrated);

  // Log security state for debugging (remove in production if verbose)
  useEffect(() => {
    if (user) {
      console.log('[useAuth] Security state:', {
        userId: user.id,
        membershipStatus: user.membershipStatus,
        isMembershipActive,
        isApprovedForCalibration,
        hasGymMapping,
        hasValidMemberId,
        isCalibrated,
        gymId: user.gymId || 'MISSING',
        accessMode: user.accessMode || 'MISSING',
        uniqueId: user.uniqueId || 'MISSING',
      });
    }
  }, [user?.id, user?.membershipStatus, isMembershipActive, isApprovedForCalibration, hasGymMapping, hasValidMemberId, isCalibrated]);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      deleteAccount,
      refreshUser,
      mergeUserData,
      triggerApprovalReset,
      refreshUserWithDiagnostics,
      beginAuthOperation,
      endAuthOperation,
      isAdmin,
      isMember,
      isActiveMember,
      isPendingRejected,
      // ── Calibration ──────────────────────────────────────
      isCalibrated,
      // ── New (Phase 1) ────────────────────────────────────
      isGymMember,
      isEventMember,
      isPlatformAdmin,
      currentGym,
      // ── Security gates (Phase 2) ─────────────────────────
      hasGymMapping,
      hasValidMemberId,
      isApprovedForCalibration,
      isFullyOnboarded,
      approvalResetTrigger,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
