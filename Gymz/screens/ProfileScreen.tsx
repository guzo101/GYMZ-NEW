import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Dimensions,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScreenHeader } from '../components/ScreenHeader';
import { DynamicBackground } from '../components/dashboard/DynamicBackground';
import QRCode from 'react-native-qrcode-svg';
import { useAuth, mapProfile } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { calendarSelectionService } from '../services/calendarSelectionService';
import { useTheme } from '../hooks/useTheme';
import { designSystem } from '../theme/designSystem';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { DataMapper } from '../utils/dataMapper';

const CACHE_KEY_PROFILE = 'Gymz_profile_cache';

const { width } = Dimensions.get('window');

/** Fire-and-forget; never throws. RPC may not exist yet — avoids .catch crash. */
function safeTrackConversion(userId: string | undefined, sourceType: string): void {
  if (!userId) return;
  (async () => {
    try {
      const result = (supabase as any).rpc?.('track_conversion', { p_user_id: userId, p_source_type: sourceType });
      if (result && typeof result.then === 'function') await result;
    } catch { /* noop */ }
  })();
}

const TAB_BAR_CLEARANCE = 80; // Space for floating tab bar (root handles nav bar inset)

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { user, logout, refreshUser, isEventMember, isAdmin } = useAuth();
  const { theme, isDark, gender, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [qrString, setQrString] = useState<string | null>(null);
  const [qrExpiresAt, setQrExpiresAt] = useState<number | null>(null);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [subStatus, setSubStatus] = useState<string>('inactive');
  const [debugNotes, setDebugNotes] = useState<string | null>(null);
  const [updatingGender, setUpdatingGender] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  const [stats, setStats] = useState({
    totalWorkouts: 0,
    weightLost: 0,
    caloriesBurned: 0,
    waterIntake: 0,
  });
  const [level, setLevel] = useState(1);
  const [tier, setTier] = useState('BRONZE');
  const [upcomingClasses, setUpcomingClasses] = useState<any[]>([]);
  const [tribeCount, setTribeCount] = useState(0);

  async function generateSecureQR(userId: string) {
    try {
      const { fetchUserSubscription, generateSecureQRCode, encodeQRData } = require('../services/secureQRService');
      const sub = await fetchUserSubscription(userId);

      if (!sub) {
        setSubscriptionError("Identity record not found.");
        setSubStatus('inactive');
        setDebugNotes("No database record found for this User ID.");
        return;
      }

      setSubStatus(sub.subscriptionStatus);
      setDebugNotes(sub.debugNotes || null);

      // If overdue/expired, set the error message but STILL generate the QR
      if (sub.subscriptionStatus !== 'active') {
        setSubscriptionError(sub.subscriptionStatus === 'guest' ? "Guest Identification" : "Subscription Overdue");
      } else {
        setSubscriptionError(null);
      }

      const secureQR = await generateSecureQRCode(userId, sub);
      const encoded = encodeQRData(secureQR);

      setQrString(encoded);
      setQrExpiresAt(secureQR.expiresAt);
      setTimeRemaining(60);

      // Calculate days remaining
      if (sub.subscriptionEndDate) {
        const end = new Date(sub.subscriptionEndDate);
        const now = new Date();
        const diffTime = end.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        setDaysRemaining(Math.max(0, diffDays));
      } else {
        setDaysRemaining(0);
      }
    } catch (error) {
      console.error('Error generating secure QR:', error);
      setSubscriptionError("System error. Contact Support.");
    }
  }

  // Cache Keys
  const CACHE_KEY_PROFILE = `profile_data_v1`;

  // 1. Load Cache Immediately
  useEffect(() => {
    async function loadCache() {
      if (!user?.id) return;
      try {
        const cached = await AsyncStorage.getItem(`${CACHE_KEY_PROFILE}_${user.id}`);
        if (cached) {
          const data = JSON.parse(cached);
          if (data.profile) setProfile(mapProfile(data.profile, user.email));
          if (data.level) setLevel(data.level);
          if (data.tier) setTier(data.tier);
          if (data.stats) setStats(data.stats);
          if (data.qrString) setQrString(data.qrString);
          if (data.daysRemaining !== undefined) setDaysRemaining(data.daysRemaining);

          // Unblock UI immediately if we have data
          setLoading(false);

          // If cache is "hollow" (missing IDs), trigger an immediate fresh priority fetch
          if (!data.profile?.uniqueId && !data.profile?.unique_id) {
            console.log('[Profile] Cache is hollow, forcing priority sync...');
            fetchProfileData();
          }
        }
      } catch (e) {
        console.warn('Profile cache load failed', e);
      }
    }
    loadCache();
  }, [user?.id]);

  // 1.5 Strict State Isolation: Reset all states when user ID changes
  useEffect(() => {
    if (user?.id) {
      setProfile(null);
      setQrString(null);
      setLevel(1);
      setTier('BRONZE');
      setStats({
        totalWorkouts: 0,
        weightLost: 0,
        caloriesBurned: 0,
        waterIntake: 0,
      });
      setUpcomingClasses([]);
    }
  }, [user?.id]);

  const fetchProfileData = useCallback(async () => {
    if (!user?.email || !user?.id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    // Only show full-screen loader if we have NO profile data yet (no cache hit)
    if (!profile) setLoading(true);

    try {
      console.log('[Profile] Fetching Turbo consolidated data...');

      // Add timeout promise to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('RPC timeout')), 10000)
      );

      const rpcPromise = (supabase as any).rpc('get_unified_app_data', {
        p_user_id: user.id,
        p_date: format(new Date(), 'yyyy-MM-dd')
      });

      const { data: turboDataRaw, error: turboError } = await Promise.race([
        rpcPromise,
        timeoutPromise
      ]) as any;

      if (turboError) {
        console.warn('[Profile] Turbo RPC error, falling back to basic fetch:', turboError);
        throw turboError;
      }

      const turboData = DataMapper.fromDb<any>(turboDataRaw);

      const {
        profile: turboProfile,
        nutrition: turboNutrition,
        gamification: turboGamification,
        fitness: turboFitness,
        calendar: turboCalendar
      } = turboData || {};

      let calculatedDays = 0;
      if (turboProfile) {
        const sanitizedProfile = mapProfile(turboProfile, user.email);
        setProfile(sanitizedProfile);

        // Immediate Calculation: Don't wait for separate QR service fetch
        const expiryDate = sanitizedProfile.renewalDueDate;
        if (expiryDate) {
          const end = new Date(expiryDate);
          const now = new Date();
          const diffTime = end.getTime() - now.getTime();
          calculatedDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
          setDaysRemaining(calculatedDays);
        } else {
          setDaysRemaining(0);
        }

        // Decouple QR generation (it will also setDaysRemaining but this provides immediate UI update)
        generateSecureQR(user.id).catch(() => { });
      }

      // --- Process XP & Level ---
      if (turboGamification) {
        const currentLevel = turboGamification.level || 1;
        setLevel(currentLevel);

        let newTier = 'BRONZE';
        if (currentLevel >= 11 && currentLevel <= 25) newTier = 'GOLD';
        else if (currentLevel >= 26 && currentLevel <= 50) newTier = 'PLATINUM';
        else if (currentLevel >= 51) newTier = 'DIAMOND';
        setTier(newTier);
      }

      // --- Process Stats ---
      setTribeCount(turboFitness?.roomCount || 0);

      const newStats = {
        totalWorkouts: turboFitness?.workoutCount || 0,
        weightLost: profile?.weightLost || 0,
        caloriesBurned: turboNutrition?.todayCalories || 0,
        waterIntake: turboNutrition?.todayWater || 0,
      };
      setStats(newStats);

      // --- Process Calendar ---
      const sortedClasses = (turboCalendar || [])
        .map((booking: any) => booking.gymClassSchedules)
        .filter(Boolean)
        .slice(0, 5);
      setUpcomingClasses(sortedClasses);

      // --- CACHE ---
      const cacheData = {
        profile: turboProfile,
        stats: newStats,
        level: turboGamification?.level,
        tier: (turboGamification?.level >= 11 ? 'GOLD' : 'BRONZE'), // Simplified tier
        daysRemaining: calculatedDays
      };
      AsyncStorage.setItem(`${CACHE_KEY_PROFILE}_${user.id}`, JSON.stringify(cacheData)).catch(() => { });

    } catch (err) {
      console.error('[Profile] Turbo fetch error, using basic fallback:', err);

      // FALLBACK: Basic profile fetch if RPC fails
      try {
        const { data: profileData, error: profileError } = await (supabase as any)
          .from('users')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        if (profileData) {
          const sanitizedProfile = mapProfile(profileData, user.email);
          setProfile(sanitizedProfile);
          generateSecureQR(user.id).catch(() => { });
        }
      } catch (fallbackErr) {
        console.error('[Profile] Fallback fetch also failed:', fallbackErr);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, user?.email]);

  // 2. Fetch Fresh Data on Focus
  useFocusEffect(
    useCallback(() => {
      fetchProfileData();
    }, [user?.id])
  );

  // Real-time listeners for QR and schedule updates (Debounced to avoid fetch storms)
  useEffect(() => {
    if (!profile?.id) return;

    let refreshTimeout: any = null;
    const debouncedRefresh = () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => {
        console.log('[Profile] Debounced refetch triggered by real-time change');
        fetchProfileData();
      }, 2000);
    };

    const userChannel = (supabase as any)
      .channel(`profile-user-${profile.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${profile.id}` }, debouncedRefresh)
      .subscribe();

    const paymentChannel = (supabase as any)
      .channel(`profile-payment-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `user_id=eq.${profile.id}` }, debouncedRefresh)
      .subscribe();

    const bookingChannel = (supabase as any)
      .channel(`profile-booking-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gym_class_bookings', filter: `user_id=eq.${profile.id}` }, debouncedRefresh)
      .subscribe();

    const scheduleChannel = (supabase as any)
      .channel(`profile-schedule-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gym_class_schedules' }, debouncedRefresh)
      .subscribe();

    return () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      userChannel.unsubscribe();
      paymentChannel.unsubscribe();
      bookingChannel.unsubscribe();
      scheduleChannel.unsubscribe();
    };
  }, [profile?.id, fetchProfileData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProfileData();
  }, [fetchProfileData]);

  const handleUpdateGender = async (newGender: 'male' | 'female') => {
    if (!user?.id || updatingGender) return;
    setUpdatingGender(true);
    try {
      const { error } = await (supabase as any)
        .from('users')
        .update({ gender: newGender })
        .eq('id', user.id);

      if (error) throw error;
      await refreshUser();
      Alert.alert('Success', `App persona updated to ${newGender} mode!`);
      fetchProfileData();
    } catch (err) {
      console.error('Error updating gender:', err);
      Alert.alert('Error', 'Failed to update theme preference.');
    } finally {
      setUpdatingGender(false);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to logout?');
      if (confirmed) {
        logout();
      }
      return;
    }
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => logout()
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const memberName = profile?.name || user?.name || '';
  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '';
  const qrValue = qrString || '';

  const displayHeight = profile?.height || user?.height;
  const displayWeight = profile?.weight || user?.weight;
  const displayAge = profile?.age || user?.age;
  const displayGoal = profile?.goal || user?.goal;

  let calculatedBmi = profile?.calculatedBmi || '--';
  if (calculatedBmi === '--' && displayHeight && displayWeight) {
    const h = parseFloat(displayHeight);
    const w = parseFloat(displayWeight);
    if (h > 0 && w > 0) {
      calculatedBmi = (w / ((h / 100) * (h / 100))).toFixed(1);
    }
  }

  // Tier colors
  const tierColors: { [key: string]: string[] } = {
    BRONZE: ['#CD7F32', '#B8733C'],
    GOLD: ['#FFD700', '#FFA500'],
    PLATINUM: ['#2A4B2A', '#F1C93B'],
    DIAMOND: ['#00D2FC', '#2A4B2A'],
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <DynamicBackground rotationType="fixed" fixedIndex={3} />
      <ScreenHeader
        title="User Profile"
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: TAB_BAR_CLEARANCE }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {/* NEW (Phase 3): Upgrade CTA for Event Access Users */}
        {isEventMember && (
          <TouchableOpacity
            style={styles.upgradeBanner}
            onPress={() => {
              const params: Record<string, unknown> = { accessMode: 'gym_access' };
              if (user?.gymId) params.gym = { id: user.gymId };
              navigation.navigate('SubscriptionPlans', params);
              void safeTrackConversion(user?.id, 'profile_upgrade_banner');
            }}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#2A4B2A', '#1B241B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.upgradeBannerGradient}
            >
              <View style={styles.upgradeBannerContent}>
                <View style={[styles.upgradeIconBox, { backgroundColor: '#F1C93B20' }]}>
                  <MaterialCommunityIcons name="lightning-bolt" size={24} color="#F1C93B" />
                </View>
                <View style={styles.upgradeTextBody}>
                  <Text style={styles.upgradeTitle}>Become a Full Gym Member</Text>
                  <Text style={styles.upgradeSubtitle}>Unlock structured workouts, nutrition & full community access</Text>
                </View>
                <MaterialCommunityIcons name="arrow-right-circle" size={28} color="#F1C93B" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Profile Overview */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrapper}>
            {(profile?.avatarUrl || user?.avatarUrl) ? (
              <Image
                source={{ uri: profile?.avatarUrl || user?.avatarUrl }}
                style={[styles.profileAvatar, { borderColor: theme.border }]}
              />
            ) : (
              <View style={[styles.profileAvatar, styles.avatarPlaceholder, { backgroundColor: theme.backgroundInput, borderColor: theme.border }]}>
                <MaterialCommunityIcons name="account" size={50} color={theme.textMuted} />
              </View>
            )}
          </View>
          <Text style={[styles.profileName, { color: theme.text }]}>{memberName}</Text>
          <View style={styles.tierContainer}>
            <View style={[styles.tierBadgeFixed, { backgroundColor: (profile?.membershipType === 'PRO' ? '#FFD700' : '#2A4B2A') + '20', marginBottom: 4 }]}>
              <Text style={[styles.tierBadgeText, { color: profile?.membershipType === 'PRO' ? '#FFD700' : '#2A4B2A' }]}>
                {profile?.membershipType || 'BASIC'} MEMBER
              </Text>
            </View>
            <View style={[styles.loyaltyBadge, { backgroundColor: (tierColors[tier] ? tierColors[tier][0] : '#CD7F32') + '10' }]}>
              <Text style={[styles.loyaltyBadgeText, { color: tierColors[tier] ? tierColors[tier][0] : '#CD7F32' }]}>Loyalty Status: {tier}</Text>
            </View>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsInspoRow}>
          <View style={styles.statInspoItem}>
            <Text style={[styles.statInspoValue, { color: theme.text }]}>{level || 1}</Text>
            <Text style={[styles.statInspoLabel, { color: theme.textSecondary }]}>Rank</Text>
          </View>
          <View style={[styles.statInspoDivider, { backgroundColor: theme.border }]} />
          {isAdmin && (
            <>
              <View style={styles.statInspoItem}>
                <Text style={[styles.statInspoValue, { color: theme.text }]}>{tribeCount || 0}</Text>
                <Text style={[styles.statInspoLabel, { color: theme.textSecondary }]}>Tribes</Text>
              </View>
              <View style={[styles.statInspoDivider, { backgroundColor: theme.border }]} />
            </>
          )}
          <View style={styles.statInspoItem}>
            <Text style={[styles.statInspoValue, { color: theme.text }]}>{daysRemaining ?? '--'}</Text>
            <Text style={[styles.statInspoLabel, { color: theme.textSecondary }]}>Days Left</Text>
          </View>
        </View>

        {/* Categories Section */}
        <View style={styles.categoriesContainer}>
          <ProfileCategory title="ACCOUNT">
            <ProfileListItem
              icon="account-edit-outline"
              label="Edit Profile"
              onPress={() => navigation.navigate('EditProfile')}
            />
            <ProfileListItem
              icon="account-cog-outline"
              label="Account Settings"
              onPress={() => navigation.navigate('Settings')}
            />
            <ProfileListItem
              icon="qrcode-scan"
              label="Gym Entry ID"
              onPress={() => {
                setShowQRModal(true);
                if (user?.id) generateSecureQR(user.id);
              }}
              rightElement={
                <View style={[styles.activeIndicator, { backgroundColor: subStatus === 'active' ? '#10B981' : theme.error }]} />
              }
            />
            <ProfileListItem
              icon="credit-card-outline"
              label="Subscription Plan"
              onPress={() => {
                const params: Record<string, unknown> = { accessMode: 'gym_access' };
                if (user?.gymId) params.gym = { id: user.gymId };
                navigation.navigate('SubscriptionPlans', params);
                safeTrackConversion(user?.id, 'profile_list_item');
              }}
              value={isEventMember ? 'EVENT ACCESS' : subStatus.toUpperCase()}
              rightElement={isEventMember ? (
                <View style={styles.upgradeBadge}>
                  <Text style={styles.upgradeBadgeText}>UPGRADE</Text>
                </View>
              ) : null}
            />
            {user?.role === 'admin' && (
              <ProfileListItem
                icon="shield-account"
                label="Admin Management"
                onPress={() => navigation.navigate('AdminConsole')}
                badge="STAFF"
              />
            )}
          </ProfileCategory>

          <ProfileCategory title="FITNESS & WELLNESS">
            <ProfileListItem
              icon="scale-bathroom"
              label="Health Metrics & Stats"
              onPress={() => navigation.navigate('HealthMetrics')}
            />

          </ProfileCategory>

          <ProfileCategory title="MY PHYSIOLOGY">
            <View style={styles.physiologyContainer}>
              <View style={styles.physRow}>
                <View style={styles.physItem}>
                  <Text style={[styles.physLabel, { color: theme.textSecondary }]}>Height</Text>
                  <Text style={[styles.physValue, { color: theme.text }]}>{displayHeight || '--'} cm</Text>
                </View>
                <View style={styles.physItem}>
                  <Text style={[styles.physLabel, { color: theme.textSecondary }]}>Weight</Text>
                  <Text style={[styles.physValue, { color: theme.text }]}>{displayWeight || '--'} kg</Text>
                </View>
              </View>
              <View style={styles.physRow}>
                <View style={styles.physItem}>
                  <Text style={[styles.physLabel, { color: theme.textSecondary }]}>Age</Text>
                  <Text style={[styles.physValue, { color: theme.text }]}>{displayAge || '--'} yrs</Text>
                </View>
                <View style={styles.physItem}>
                  <Text style={[styles.physLabel, { color: theme.textSecondary }]}>BMI</Text>
                  <Text style={[styles.physValue, { color: theme.text }]}>{calculatedBmi}</Text>
                </View>
              </View>
              <View style={styles.physRow}>
                <View style={[styles.physItem, { flex: 1 }]}>
                  <Text style={[styles.physLabel, { color: theme.textSecondary }]}>Scientific Goal</Text>
                  <Text style={[styles.physValue, { color: theme.text, fontSize: 14 }]}>
                    {displayGoal?.replace(/_/g, ' ')?.toUpperCase() || '--'}
                  </Text>
                </View>
              </View>
            </View>
          </ProfileCategory>

          <ProfileCategory title="APP PREFERENCES">
            <ProfileListItem
              icon="palette-outline"
              label="App Theme Mode"
              onPress={toggleTheme}
              value={isDark ? 'Dark' : 'Light'}
            />
            <ProfileListItem
              icon="human-male-female"
              label="App Persona"
              onPress={() => handleUpdateGender(gender === 'male' ? 'female' : 'male')}
              value={gender?.charAt(0).toUpperCase() + gender?.slice(1)}
            />
          </ProfileCategory>
        </View>

        {/* Logout Button */}
        <View style={styles.logoutContainer}>
          <TouchableOpacity style={styles.inspoLogoutButton} onPress={handleLogout}>
            <Text style={styles.inspoLogoutText}>LOGOUT</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* QR Code Modal */}
      {
        showQRModal && (
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowQRModal(false)}
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }]}
          >
            <TouchableOpacity
              style={{ position: 'absolute', top: 50, right: 20, padding: 10 }}
              onPress={() => setShowQRModal(false)}
            >
              <MaterialCommunityIcons name="close" size={32} color="#FFF" />
            </TouchableOpacity>

            <TouchableWithoutFeedback>
              <View style={[styles.modalCard, { backgroundColor: '#FFF' }]}>
                <Text style={[styles.modalTitle, { color: '#000' }]}>Gym Entry ID</Text>
                <View style={[styles.qrWrapper, { borderColor: subStatus === 'active' ? theme.primary : theme.error }]}>
                  {qrString ? (
                    <QRCode value={qrString} size={200} backgroundColor="transparent" color="#000" />
                  ) : (
                    <ActivityIndicator size="large" color={theme.primary} />
                  )}
                </View>
                <Text style={[styles.modalId, { color: '#666' }]}>
                  {profile?.uniqueId?.startsWith('EV-') ? 'Event Guest ID' : 'Member ID'}: #{profile?.uniqueId || '---'}
                </Text>
                <Text style={[styles.modalStatus, { color: subStatus === 'active' ? '#10B981' : (isEventMember ? '#4CAF50' : theme.error) }]}>
                  Status: {isEventMember ? 'EVENT ACCESS' : subStatus.toUpperCase()}
                </Text>

                <View style={{ marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9', width: '100%', alignItems: 'center' }}>
                  {debugNotes && (
                    <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 2, fontWeight: '600' }}>
                      REPORTED FAULT: {debugNotes}
                    </Text>
                  )}
                </View>

                {(!!debugNotes || !profile?.uniqueId || profile?.uniqueId === '---' || subStatus !== 'active') && (
                  <View style={{
                    backgroundColor: '#FEF2F2',
                    borderWidth: 1,
                    borderColor: '#FECACA',
                    borderRadius: 16,
                    padding: 12,
                    marginTop: 16,
                    width: '100%',
                    alignItems: 'center'
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <MaterialCommunityIcons name="alert-decagram" size={18} color="#EF4444" />
                      <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '900', marginLeft: 6, letterSpacing: 1 }}>
                        DIAGNOSTIC DATA
                      </Text>
                    </View>
                    <Text style={{ color: '#1E293B', fontSize: 13, fontWeight: '700', textAlign: 'center' }}>
                      {debugNotes || (!profile?.uniqueId ? "ID Not Linked to this Account" : "Synchronization Required")}
                    </Text>
                    {!profile?.gymId && (
                      <Text style={{ color: '#EF4444', fontSize: 11, marginTop: 4, fontStyle: 'italic', fontWeight: 'bold' }}>
                        Error: Missing Gym Mapping in Profile
                      </Text>
                    )}
                  </View>
                )}

                {qrExpiresAt && (
                  <View style={styles.modalTimer}>
                    <MaterialCommunityIcons name="clock-outline" size={14} color="#666" />
                    <Text style={{ color: '#666', fontSize: 12 }}>Regenerates in {timeRemaining}s</Text>
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>

            <TouchableOpacity
              style={[styles.modalCloseBtn, { backgroundColor: theme.primary }]}
              onPress={() => setShowQRModal(false)}
            >
              <Text style={styles.modalCloseText}>CLOSE</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )
      }
    </View >
  );
}

// Components for the new layout
const ProfileCategory = ({ title, children }: any) => {
  const { theme, isDark } = useTheme();
  return (
    <View style={styles.categoryWrap}>
      <Text style={[styles.categoryTitle, { color: theme.textMuted }]}>{title}</Text>
      <View style={[styles.categoryContent, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.8)', borderColor: theme.border }]}>
        {children}
      </View>
    </View>
  );
};

const ProfileListItem = ({ icon, label, onPress, value, rightElement, badge }: any) => {
  const { theme } = useTheme();
  return (
    <TouchableOpacity style={styles.listItem} onPress={onPress}>
      <View style={styles.listIconContainer}>
        <MaterialCommunityIcons name={icon} size={22} color={theme.text} />
      </View>
      <Text style={[styles.listLabel, { color: theme.text }]}>{label}</Text>
      <View style={styles.listRight}>
        {badge && (
          <View style={[styles.listBadge, { backgroundColor: theme.primary }]}>
            <Text style={styles.listBadgeText}>{badge}</Text>
          </View>
        )}
        {value && <Text style={[styles.listValue, { color: theme.textSecondary }]}>{value}</Text>}
        {rightElement}
        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textMuted} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  // New organized layout styles
  profileHeader: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 30,
  },
  avatarWrapper: {
    marginBottom: 16,
    borderRadius: 60,
    backgroundColor: 'transparent',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  profileAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    overflow: 'hidden',
  },
  tierBadgeFixed: {
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderRadius: 20,
    alignSelf: 'center',
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  tierContainer: {
    alignItems: 'center',
    gap: 4,
  },
  loyaltyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 8,
  },
  loyaltyBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statsInspoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  statInspoItem: {
    alignItems: 'center',
    flex: 1,
  },
  statInspoValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  statInspoLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  statInspoDivider: {
    width: 1,
    height: 30,
    opacity: 0.5,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  categoriesContainer: {
    paddingHorizontal: 20,
    gap: 24,
  },
  categoryWrap: {
    gap: 12,
  },
  categoryTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  categoryContent: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  listIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  listLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  listRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
    justifyContent: 'flex-end',
    maxWidth: '50%',
  },
  listValue: {
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
  },
  listBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  listBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  activeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  physiologyContainer: {
    padding: 16,
    gap: 16,
  },
  physRow: {
    flexDirection: 'row',
    gap: 12,
  },
  physItem: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  physLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  physValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  logoutContainer: {
    marginTop: 40,
    paddingHorizontal: 20,
  },
  inspoLogoutButton: {
    borderColor: '#EF4444',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inspoLogoutText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 2,
  },
  // Modal styles
  modalCard: {
    width: width * 0.85,
    padding: 30,
    borderRadius: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 24,
    letterSpacing: 1,
  },
  qrWrapper: {
    padding: 16,
    borderRadius: 24,
    borderWidth: 4,
    backgroundColor: '#FFF',
    marginBottom: 20,
  },
  modalId: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  modalStatus: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 16,
  },
  modalTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalCloseBtn: {
    marginTop: 30,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 20,
  },
  modalCloseText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  // Upgrade Banner Styles
  upgradeBanner: {
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(241,201,59,0.2)',
  },
  upgradeBannerGradient: {
    padding: 16,
  },
  upgradeBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  upgradeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(241,201,59,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  upgradeTextBody: {
    flex: 1,
  },
  upgradeTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  upgradeSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 2,
  },
  upgradeBadge: {
    backgroundColor: '#F1C93B20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F1C93B40',
  },
  upgradeBadgeText: {
    color: '#F1C93B',
    fontSize: 10,
    fontWeight: '800',
  },
});

