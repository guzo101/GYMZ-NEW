import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GymzLogo } from '../components/GymzLogo';
import { useDramaBridge, type NormalizedLogoBounds } from '../components/coachBubble/drama/DramaBridgeContext';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../services/supabase';
import { designSystem } from '../theme/designSystem';
import { dashboardService } from '../services/dashboardService';
import { DataMapper } from '../utils/dataMapper';
import { getAuthLogoLayout } from '../utils/authScreenLogoLayout';

const PHASES = { LOGIN: 'login', REGISTER: 'register', FORGOT: 'forgot' };

// Design reference dimensions: layout scales from this base for different screen sizes
const DESIGN_WIDTH = 360;
const DESIGN_HEIGHT = 800;

// 8pt spacing scale: keeps vertical rhythm and hierarchy consistent
const SPACE = {
  xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 40, xxxl: 56,
};

// Form panel vertical scale: 0.42 = reduced by a quarter again (0.5625 * 0.75)
const FORM_PANEL_SCALE = 0.42;

export default function LoginScreen({ navigation, route }: any) {
  const params = route?.params ?? {};
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { theme: _contextTheme, isDark: _contextIsDark } = useTheme();
  // Auth screens always use the app default bright theme (no dark/system override)
  const theme = designSystem.colors.light;
  const isDark = false;
  // Responsive: scale from DESIGN_* (smaller screens shrink, larger cap); safe area for notch/home; ScrollView for overflow; maxWidth on tablet
  const layout = useMemo(() => {
    const scaleW = Math.min(width / DESIGN_WIDTH, 1.1);
    const scaleH = Math.min(height / DESIGN_HEIGHT, 1.05);
    const scale = Math.min(scaleW, scaleH, 1);
    const s = (n: number) => Math.round(n * scale);
    const f = (n: number) => s(n * FORM_PANEL_SCALE);
    const authLogo = getAuthLogoLayout(width, height, insets);
    return {
      logoSize: authLogo.logoSize,
      logoPadding: authLogo.logoPaddingPx,
      paddingH: s(SPACE.lg),
      scrollPaddingTop: s(SPACE.xs),
      scrollPaddingBottom: s(SPACE.sm),
      logoToTagline: s(SPACE.xs),
      taglineMarginTop: s(SPACE.xs),
      logoShiftUp: s(24), // move logo alone up a bit
      brandingMarginTop: 0,
      contentShiftUp: s(56), // pull login/create-account block up for better positioning
      brandingToForm: s(SPACE.xxl),
      formCardPadding: f(SPACE.xl),
      formHeaderGap: f(SPACE.lg),
      formTitleToSubtitle: f(SPACE.xs),
      inputLabelToField: f(SPACE.sm),
      inputGap: f(SPACE.lg),
      inputHeight: s(50),
      errorMarginTop: f(SPACE.sm),
      buttonTop: f(SPACE.xl),
      buttonPaddingVertical: f(SPACE.md + 2),
      linksTop: f(SPACE.xxl),
      footerRowGap: f(SPACE.md),
    };
  }, [width, height, insets]);
  const { login, beginAuthOperation, endAuthOperation } = useAuth();
  const { setLogoBounds, setCurrentScreen } = useDramaBridge();
  const [phase, setPhase] = useState(PHASES.LOGIN);
  const [email, setEmail] = useState(() => (params.email != null ? String(params.email) : ''));
  const [password, setPassword] = useState(() => (params.password != null ? String(params.password) : ''));
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const fromDuplicateSignup = Boolean(params.fromDuplicateSignup);
  const [pendingUser, setPendingUser] = useState<any>(null);
  const mounted = useRef(true);
  const logoContainerRef = useRef<View>(null);

  // Register Login screen with drama overlay and clear logo bounds on unmount
  useEffect(() => {
    setCurrentScreen('Login');
    return () => {
      setCurrentScreen(null);
      setLogoBounds(null);
    };
  }, [setCurrentScreen, setLogoBounds]);

  useEffect(() => {
    return () => { mounted.current = false; };
  }, []);

  const handleLogoLayout = useCallback(() => {
    logoContainerRef.current?.measureInWindow((winX, winY) => {
      if (typeof width !== 'number' || typeof height !== 'number' || width < 1 || height < 1) return;
      // Logo image is inside the padded container: offset by layout.logoPadding, size layout.logoSize
      const pad = layout.logoPadding;
      const size = layout.logoSize;
      const logoLeft = winX + pad;
      const logoTop = winY + pad;
      const logoRight = logoLeft + size;
      const logoBottom = logoTop + size;
      const bounds: NormalizedLogoBounds = {
        leftX: logoLeft / width,
        rightX: logoRight / width,
        topY: logoTop / height,
        bottomY: logoBottom / height,
        centerX: (logoLeft + logoRight) / 2 / width,
        centerY: (logoTop + logoBottom) / 2 / height,
      };
      setLogoBounds(bounds);
      console.log('[LoginScreen] Logo position (from measureInWindow)', {
        px: { x: logoLeft, y: logoTop, width: size, height: size },
        normalized: bounds,
      });
    });
  }, [width, height, layout.logoPadding, layout.logoSize, setLogoBounds]);

  // Single keyboard handler: KeyboardAvoidingView only. No manual padding or delayed scrollTo.

  function resetFields() {
    setEmail('');
    setPassword('');
    setName('');
    setError('');
  }

  async function handleLogin() {
    setError('');
    if (!email || !password) {
      setError('Please fill in both email and password');
      return;
    }
    console.log('[LoginScreen] handleLogin triggered');
    beginAuthOperation();
    setLoading(true);

    try {
      // PROMISE RACE: Timeout after 30 seconds (slow networks, cold DB)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Login timed out. Please check your connection.")), 30000)
      );

      const loginProcess = async () => {
        console.log('[LoginScreen] Step 1: signInWithPassword');
        // Sign in with Supabase
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (authError) throw authError;
        console.log('[LoginScreen] Step 2: auth OK, fetching users by id');

        if (data.user) {
          // STRICT: Fetch profile by ID first
          const { data: userData, error: userErr } = await (supabase as any)
            .from('users')
            .select('*')
            .eq('id', data.user.id)
            .maybeSingle();

          if (userErr) {
            console.error('[LoginScreen] users fetch error:', userErr);
            throw new Error(userErr.message || 'Could not load your profile. Please try again.');
          }

          if (userData) {
            console.log('[LoginScreen] Step 3: userData found, calling login()');
            const appUser = DataMapper.fromDb<any>(userData);

            // Check account status (active/suspended)
            const accountStatus = (appUser.status || 'active').toLowerCase();
            const membershipStatus = (appUser.membershipStatus || 'pending').toLowerCase();

            if (accountStatus === 'suspended') {
              console.warn('[LoginScreen] Login blocked for suspended user:', data.user.id);
              await supabase.auth.signOut();
              throw new Error("Your account has been suspended. Please contact support.");
            }

            let effectiveMembershipStatus = appUser.membershipStatus;

            // ROBUSTNESS CHECK: If not already pending/active, check if they have a pending payment
            if (!effectiveMembershipStatus || (effectiveMembershipStatus.toLowerCase() !== 'active' && effectiveMembershipStatus.toLowerCase() !== 'pending')) {
              const { data: pendingPayments } = await supabase
                .from('payments')
                .select('id')
                .eq('user_id', data.user.id)
                .eq('status', 'pending')
                .limit(1);

              if (pendingPayments && pendingPayments.length > 0) {
                console.log('[LoginScreen] Detected pending payment, forcing status to Pending');
                effectiveMembershipStatus = 'Pending';

                // Also sync this to the users table so we don't have to check payments table every time
                await (supabase as any).from('users').update(DataMapper.toDb({ membershipStatus: 'Pending' })).eq('id', data.user.id);
              }
            }

            // PRE-ARM DASHBOARD CACHE (non-blocking) — must not block login.
            // get_unified_app_data RPC can hang/slow on cold DB; dashboard fetches its own data on mount.
            void dashboardService.preArmDashboard(userData.id);

            // ── CALIBRATION CHECK (Absolute Lockdown) ────────────────
            const isCalibrated = Boolean(
              Number(appUser.height) > 0 &&
              Number(appUser.weight) > 0 &&
              Number(appUser.age) > 0 &&
              appUser.gender &&
              (appUser.primaryObjective || appUser.goal)
            );

            await login({
              id: appUser.id,
              email: appUser.email,
              name: appUser.name,
              firstName: appUser.firstName,
              lastName: appUser.lastName,
              role: appUser.role || 'member',
              status: accountStatus,
              membershipStatus: effectiveMembershipStatus,
              avatarUrl: appUser.avatarUrl,
              phone: appUser.phone,
              goal: appUser.primaryObjective || appUser.goal,
              gender: appUser.gender,
              height: appUser.height,
              weight: appUser.weight,
              age: appUser.age,
              targetWeight: appUser.targetWeight,
              goalTimeframe: appUser.goalTimeframe,
              uniqueId: appUser.uniqueId,
              gymId: appUser.gymId || null,
              accessMode: appUser.accessMode || null,
              isCalibrated: isCalibrated,
            } as any);
            console.log('[LoginScreen] Step 4: login() complete');
          } else {
            // Check by email to see if we need to link an existing record
            const { data: emailUser, error: emailErr } = await (supabase as any)
              .from('users')
              .select('*')
              .eq('email', email.trim())
              .maybeSingle();

            if (emailErr) {
              console.error('[LoginScreen] users by email fetch error:', emailErr);
              throw new Error(emailErr.message || 'Could not load your profile. Please try again.');
            }

            if (emailUser) {
              const appEmailUser = DataMapper.fromDb<any>(emailUser);
              console.log('[LoginScreen] Linking existing email record to Auth ID...');

              const accountStatus = (appEmailUser.status || 'active').toLowerCase();
              if (accountStatus === 'suspended') {
                await supabase.auth.signOut();
                throw new Error("Your account has been suspended. Please contact support.");
              }

              const { data: updatedData } = await (supabase as any)
                .from('users')
                .update({ id: data.user.id })
                .eq('email', email.trim())
                .select()
                .single();

              if (updatedData) {
                const appUpdatedData = DataMapper.fromDb<any>(updatedData);
                // PRE-ARM DASHBOARD CACHE (non-blocking) — must not block login.
                void dashboardService.preArmDashboard(appUpdatedData.id);

                let linkedMStatus = appUpdatedData.membershipStatus;
                if (!linkedMStatus || (linkedMStatus.toLowerCase() !== 'active' && linkedMStatus.toLowerCase() !== 'pending')) {
                  const { data: linkedPending } = await supabase
                    .from('payments')
                    .select('id')
                    .eq('user_id', data.user.id)
                    .eq('status', 'pending')
                    .limit(1);
                  if (linkedPending && linkedPending.length > 0) linkedMStatus = 'Pending';
                }

                await login({
                  id: appUpdatedData.id,
                  email: appUpdatedData.email,
                  name: appUpdatedData.name,
                  role: appUpdatedData.role,
                  status: appUpdatedData.status || 'active',
                  membershipStatus: linkedMStatus || 'New',
                  height: appUpdatedData.height,
                  weight: appUpdatedData.weight,
                  age: appUpdatedData.age,
                  gender: appUpdatedData.gender,
                  goal: appUpdatedData.primaryObjective || appUpdatedData.goal,
                  uniqueId: appUpdatedData.uniqueId,
                  gymId: appUpdatedData.gymId || null,
                  accessMode: appUpdatedData.accessMode || null,
                  isCalibrated: false
                } as any);
              }
            } else {
              // NO PROFILE FOUND: Create one immediately.
              console.log('[LoginScreen] No profile found. Creating fresh record.');

              const newProfile = {
                id: data.user.id,
                email: data.user.email || email.trim(),
                name: (data.user as any).userMetadata?.name || email.trim().split('@')[0],
                role: 'member',
                status: 'active',
                membershipStatus: 'New',
                createdAt: new Date().toISOString(),
                metadata: (data.user as any).userMetadata || {}
              };

              const { error: createError } = await (supabase as any).from('users').insert([DataMapper.toDb(newProfile)]);

              if (createError) {
                console.error('[LoginScreen] Failed to create fresh profile:', createError);
                throw new Error("Failed to initialize user profile. Please contact support.");
              }

              await login({ ...newProfile, isCalibrated: false } as any);
            }
          }
        }
      };

      await Promise.race([loginProcess(), timeoutPromise]);

      resetFields();
    } catch (err: any) {
      console.error('Login error:', err);
      endAuthOperation();

      // Check for unconfirmed email error
      if (err.message?.toLowerCase().includes('email not confirmed')) {
        Alert.alert(
          'Email Not Verified',
          'Your email has not been verified yet. Would you like to enter your verification code?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Verify Now',
              onPress: () => navigation.navigate('EmailVerification', { email: email.trim(), password })
            }
          ]
        );
        return;
      }

      // Give a more helpful error specific to timeouts
      const errMsg = err.message === "Login timed out. Please check your connection."
        ? err.message
        : (err.message || 'Login failed. Please check your credentials.');
      setError(errMsg);
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }

  async function handleRegister() {
    setError('');
    if (!email || !password || !name) {
      setError('All fields are required');
      return;
    }
    setLoading(true);

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: DataMapper.toDb({
            name: name.trim(),
          })
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Create user in users table
        const { error: insertError } = await (supabase as any).from('users').insert({
          id: authData.user.id,
          email: email.trim(),
          name: name.trim(),
          role: 'member',
        });

        if (insertError) {
          console.error('User insert error:', insertError);
          throw new Error("Failed to create user profile. Please try again.");
        }

        await login({
          id: authData.user.id,
          email: authData.user.email || email,
          name: name.trim(),
          role: 'member',
          isCalibrated: false
        } as any);

        resetFields();
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      const msg = (err.message || '').toLowerCase();
      const isNetworkError = /failed to fetch|network request failed|timeout|connection refused/i.test(msg);
      setError(isNetworkError ? 'Please check your connection and try again.' : (err.message || 'Registration failed'));
    } finally {
      setLoading(false);
    }
  }



  async function handleForgot() {
    setError('');
    if (!email) {
      setError('Enter your email to reset password');
      return;
    }
    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'gymz://reset-password'
      });

      if (resetError) throw resetError;

      // Immediately navigate to ResetPassword screen with email pre-filled
      // User can enter the code right away without waiting for alert
      navigation.navigate('ResetPassword', { email: email.trim() });

      // Show success message non-blocking (optional, can be removed if not needed)
      Alert.alert(
        'Email Sent',
        `A reset link and 6-digit code has been sent to ${email}. Enter the code below.`,
        [{ text: 'OK' }]
      );
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError(err.message || 'Password reset failed');
      setLoading(false);
    }
  }

  const title =
    phase === PHASES.REGISTER
      ? 'Create Account'
      : phase === PHASES.FORGOT
        ? 'Reset Password'
        : 'Log in';

  const subtitle =
    phase === PHASES.REGISTER
      ? 'Join the Gymz fitness community'
      : phase === PHASES.FORGOT
        ? 'Enter your email to reset password'
        : 'Enter your details to log in';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        {/* Background Gradient */}
        <LinearGradient
          colors={
            isDark
              ? ['#020402', '#040704', '#030503'] // Nocturnal dark theme
              : [
                theme.primaryLight || '#E8EFE8',
                '#D0DDD0',
                theme.background || '#F8FAFC',
              ]
          }
          style={styles.backgroundGradient}
        />

        {/* Decorative Elements */}
        <View style={styles.decorativeBlob1} />
        <View style={styles.decorativeBlob2} />

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: layout.paddingH,
              paddingTop: layout.scrollPaddingTop,
              paddingBottom: layout.scrollPaddingBottom,
              flexGrow: 1,
              justifyContent: 'center',
            },
          ]}
          centerContent={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          bounces={false}
          scrollEnabled={true}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustKeyboardInsets={false}
        >
          <View style={{ flexGrow: 0, marginTop: -layout.contentShiftUp }}>
            {/* Logo and Branding */}
            <View style={[styles.brandingSection, { marginTop: layout.brandingMarginTop, marginBottom: layout.brandingToForm }]}>
              <View ref={logoContainerRef} onLayout={handleLogoLayout} style={{ padding: layout.logoPadding, marginTop: -layout.logoShiftUp }} collapsable={false}>
                <GymzLogo
                  size={layout.logoSize}
                  imageStyle={{ width: layout.logoSize, marginBottom: layout.logoToTagline } as any}
                />
              </View>
              <Text
                style={[styles.tagline, { marginTop: layout.taglineMarginTop, color: theme.primary }]}
                numberOfLines={1}
              >
                Results start with what you eat. Track it.
              </Text>
              <View style={[styles.poweredByRow, { marginTop: layout.taglineMarginTop * 1.5 }]}>
                <Text style={[styles.poweredBy, { color: isDark ? 'rgba(255, 255, 255, 0.3)' : theme.textMuted }]} numberOfLines={1}>Powered by AI ✨</Text>
              </View>
            </View>

            {/* Form Card */}
            <View style={[styles.formCard, { padding: layout.formCardPadding, backgroundColor: theme.backgroundCard, borderColor: theme.border }]}>
              <View style={[styles.formHeader, { marginBottom: layout.formHeaderGap }]}>
                {fromDuplicateSignup ? (
                  <View style={[styles.duplicateSignupBanner, { backgroundColor: isDark ? 'rgba(197, 160, 40, 0.15)' : 'rgba(42, 75, 42, 0.12)', borderColor: theme.primary }]}>
                    <Text style={[styles.duplicateSignupBannerText, { color: theme.text }]}>
                      Account already exists. Use the Log in option below.
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={[styles.formContent, { gap: layout.inputGap }]}>


                {phase === PHASES.REGISTER && (
                  <View style={[styles.inputGroup, { gap: layout.inputLabelToField }]}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Full Name</Text>
                    <View style={[styles.inputWrapper, { height: layout.inputHeight, backgroundColor: theme.backgroundInput, borderColor: theme.border }]}>
                      <MaterialCommunityIcons
                        name="account-outline"
                        size={22}
                        color={theme.primary}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={[styles.input, { color: theme.text }]}
                        value={name}
                        onChangeText={setName}
                        editable={!loading}
                        placeholder="Your full name"
                        placeholderTextColor={theme.textMuted}
                        autoCapitalize="words"
                      />
                    </View>
                  </View>
                )}

                <View style={[styles.inputGroup, { gap: layout.inputLabelToField }]}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Email Address</Text>
                  <View style={[styles.inputWrapper, { height: layout.inputHeight, backgroundColor: theme.backgroundInput, borderColor: theme.border }]}>
                    <MaterialCommunityIcons
                      name="email-outline"
                      size={22}
                      color={theme.primary}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[styles.input, { color: theme.text }]}
                      value={email}
                      onChangeText={setEmail}
                      editable={!loading}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      placeholder="name@example.com"
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>
                </View>

                {phase !== PHASES.FORGOT && (
                  <View style={[styles.inputGroup, { gap: layout.inputLabelToField }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap' }}>
                      <Text style={[styles.label, { flexShrink: 1, color: theme.textSecondary }]}>Password</Text>
                      {phase === PHASES.LOGIN && (
                        <TouchableOpacity onPress={() => setPhase(PHASES.FORGOT)} style={{ flexShrink: 0 }}>
                          <Text style={[styles.forgotPassText, { color: isDark ? '#C5A028' : theme.primary }]}>Forgot?</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <View style={[styles.inputWrapper, { height: layout.inputHeight, backgroundColor: theme.backgroundInput, borderColor: theme.border }]}>
                      <MaterialCommunityIcons
                        name="lock-outline"
                        size={22}
                        color={theme.primary}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={[styles.input, { color: theme.text }]}
                        value={password}
                        onChangeText={setPassword}
                        editable={!loading}
                        secureTextEntry={!showPassword}
                        placeholder="••••••••"
                        placeholderTextColor={theme.textMuted}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        style={styles.eyeIcon}
                      >
                        <MaterialCommunityIcons
                          name={showPassword ? 'eye' : 'eye-off'}
                          size={22}
                          color={theme.primary}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {error ? <Text style={[styles.errorText, { marginTop: layout.errorMarginTop }]}>{error}</Text> : null}

                {/* Primary Action Button */}
                <TouchableOpacity
                  style={[styles.button, { marginTop: layout.buttonTop }, loading && styles.buttonDisabled]}
                  onPress={
                    phase === PHASES.LOGIN
                      ? handleLogin
                      : phase === PHASES.REGISTER
                        ? handleRegister
                        : handleForgot
                  }
                  disabled={loading}
                >
                  <LinearGradient
                    colors={isDark ? ['#1A2E1A', '#C5A028'] : ['#2A4B2A', '#F1C93B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.buttonGradient, { paddingVertical: layout.buttonPaddingVertical }]}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.buttonText}>
                        {phase === PHASES.LOGIN
                          ? 'Log in'
                          : phase === PHASES.REGISTER
                            ? 'Create Account'
                            : 'Send Reset Link'}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Secondary Links */}
                <View style={[styles.linksContainer, { marginTop: layout.linksTop }]}>
                  {phase === PHASES.LOGIN ? (
                    <>
                      <View style={styles.footerRow}>
                        <Text style={[styles.footerLabel, { color: theme.textMuted }]}>Don't have an account? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                          <Text style={[styles.linkText, { color: theme.accent }]}>Sign Up</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={[styles.footerRow, { marginTop: layout.footerRowGap }]}>
                        <Text style={[styles.footerLabel, { color: theme.textMuted }]}>Want to explore? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('GymSelection')}>
                          <Text style={[styles.linkText, { color: '#34D399' }]}>Browse Gyms</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <TouchableOpacity onPress={() => { resetFields(); setPhase(PHASES.LOGIN); }}>
                      <Text style={[styles.linkText, { color: theme.accent }]}>Back to log in</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  decorativeBlob1: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(42, 75, 42, 0.04)',
    top: -150,
    right: -150,
  },
  decorativeBlob2: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(197, 160, 40, 0.03)',
    bottom: -100,
    left: -100,
  },
  scrollContent: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    minWidth: 0,
  },
  brandingSection: {
    alignItems: 'center',
    overflow: 'visible',
  },
  logoImage: {
    aspectRatio: 1,
  } as any,
  tagline: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'System', android: 'SamsungOne', default: 'System' }),
    color: '#C5A028',
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 22,
    width: 392,
    paddingHorizontal: 0,
    paddingTop: 1,
  },
  poweredByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  poweredBy: {
    fontSize: 12,
    fontWeight: '500',
    fontStyle: 'italic',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 1,
  },
  poweredBySparkle: {
    fontSize: 14,
  },
  formCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'center',
    minWidth: 0,
  },
  formHeader: {},
  formTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 0,
  },
  formSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    lineHeight: 18,
  },
  duplicateSignupBanner: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  duplicateSignupBannerText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  formContent: {},
  inputGroup: {},
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    marginLeft: 2,
  },
  forgotPassText: {
    fontSize: 13,
    color: '#C5A028',
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(42, 75, 42, 0.2)',
    borderRadius: 14,
    paddingHorizontal: 14,
    position: 'relative',
    overflow: 'hidden',
    maxWidth: '100%',
    minWidth: 0,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#FFF',
    height: '100%',
    paddingRight: 16,
    borderRadius: 16,
    backgroundColor: 'transparent',
    minWidth: 0,
    ...(Platform.OS === 'web'
      ? { outlineStyle: 'none', width: '100%', maxWidth: '100%' } as any
      : {}),
  },
  eyeIcon: {
    position: 'absolute',
    right: 8,
    height: '100%',
    justifyContent: 'center',
    padding: 8,
  },
  errorText: {
    color: '#FF4B4B',
    fontSize: 13,
    textAlign: 'center',
  },
  button: {
    borderRadius: 14,
    overflow: 'hidden',
    ...(Platform.OS === 'ios' ? {
      shadowColor: '#2A4B2A',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
    } : Platform.OS === 'android' ? {
      elevation: 5,
    } : {
      boxShadow: '0px 0px 8px rgba(42, 75, 42, 0.3)',
    }),
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonGradient: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: 'bold',
  },
  linksContainer: {
    alignItems: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerLabel: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 14,
  },
  linkText: {
    color: '#C5A028',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
