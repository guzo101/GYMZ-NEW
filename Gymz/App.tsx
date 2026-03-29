import React, { useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ExpoSplashScreen from 'expo-splash-screen';

// Keep native splash visible until our custom SplashScreen is ready (avoids flash)
ExpoSplashScreen.preventAutoHideAsync().catch(() => { });
import { Provider as PaperProvider, MD3DarkTheme, MD3LightTheme, configureFonts } from 'react-native-paper';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, Animated, Easing, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import AppNavigator from './navigation/AppNavigator';
import { registerForPushNotifications, addNotificationReceivedListener } from './services/notifications';
import { savePushToken } from './services/pushTokenService';
import { runPermissionOnboarding } from './services/permissionOnboarding';
import ErrorBoundary from './components/ErrorBoundary';
import { AnimatedSplashScreen, SPLASH_MERGE_FADE_MS } from './components/splash/AnimatedSplashScreen';
import * as Linking from 'expo-linking';
import { supabase } from './services/supabase';

import { useTheme as useGymzTheme } from './hooks/useTheme';
import { RetentionNudge } from './components/retention/RetentionNudge';
import { AutoNudgeManager } from './components/notifications/AutoNudgeManager';
import { NotificationBannerProvider } from './contexts/NotificationBannerContext';
import { CoachInsightProvider } from './contexts/CoachInsightContext';
import { CoachCharacterProvider } from './contexts/CoachCharacterContext';

/** Android SDK 35 + edge-to-edge: insets.bottom can be 0. Use fallback so content stays above nav bar. */
const ANDROID_NAV_BAR_FALLBACK_DP = 48;

function AppContent() {
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'android' && insets.bottom === 0 ? ANDROID_NAV_BAR_FALLBACK_DP : insets.bottom;
  const { isDark, theme } = useGymzTheme();
  const notificationListener = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const mainAppOpacity = useRef(new Animated.Value(0)).current;
  const [error, setError] = useState<string | null>(null);
  const startupTime = useRef<number>(Date.now());

  useEffect(() => {
    async function initialize() {
      try {
        console.log('[App Content] Starting initialization...');

        // 0. Request all permissions at startup (professional onboarding flow)
        await runPermissionOnboarding();

        // 1. Handle Deep Linking (password reset, invite-complete, auth-callback)
        const handleDeepLink = async (event: Linking.EventType) => {
          const url = event.url;
          console.log('[App] Deep link received:', url);

          // Tokens can be in hash (standard Supabase) or query params
          const hasHash = url.includes('#');
          const isResetPassword = url.includes('reset-password');
          const isInviteComplete = url.includes('invite-complete');
          const isAuthCallback = url.includes('auth/callback');

          if ((isResetPassword || isInviteComplete || isAuthCallback) && (hasHash || url.includes('?'))) {
            const queryString = hasHash ? url.split('#')[1] : url.split('?')[1];
            const params = new URLSearchParams(queryString);
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            const type = params.get('type');

            console.log('[App] Deep link parsed:', {
              isResetPassword,
              isInviteComplete,
              isAuthCallback,
              hasAccessToken: !!accessToken,
              hasRefreshToken: !!refreshToken,
              type
            });

            if (accessToken && refreshToken) {
              try {
                console.log('[App] Setting session from deep link...');
                const { data: sessionData, error } = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken
                });

                if (error) {
                  console.error('[App] Deep link session error:', error);
                } else {
                  console.log('[App] Session set successfully:', { userId: sessionData?.user?.id });

                  if (isResetPassword && (type === 'recovery' || !type)) {
                    // Wait a bit for session to propagate, then signal navigator
                    console.log('[App] Setting __pendingResetPassword flag');
                    (global as any).__pendingResetPassword = true;

                    // Double-check session after a short delay to ensure it's set
                    setTimeout(async () => {
                      const { data: { session } } = await supabase.auth.getSession();
                      if (session) {
                        console.log('[App] Session confirmed after delay, re-setting flag');
                        (global as any).__pendingResetPassword = true;
                      } else {
                        console.warn('[App] Session not found after delay, may need retry');
                      }
                    }, 500);
                  }

                  // For general auth callback, session is set, useAuth listener will handle profile fetch
                  if (isAuthCallback) {
                    console.log('[App] Auth callback processed successfully');
                  }
                }
              } catch (e) {
                console.error('[App] Deep link session error:', e);
              }
            } else {
              console.warn('[App] Deep link missing tokens:', { accessToken: !!accessToken, refreshToken: !!refreshToken });
            }
          }
        };

        const subscription = Linking.addEventListener('url', handleDeepLink);

        // Check for initial URL
        Linking.getInitialURL().then((url: string | null) => {
          if (url) handleDeepLink({ url });
        });

        // 2. Supabase Auth State Change Listener
        supabase.auth.onAuthStateChange(async (event, session) => {
          console.log('[App] Auth event:', event, { hasSession: !!session, userId: session?.user?.id });

          if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session && (global as any).__pendingResetPassword)) {
            console.log('[App] Password recovery event detected! Setting flag for navigation');
            (global as any).__pendingResetPassword = true;
          }

          // When user signs in, register push and save token so GMS can send notifications
          if (event === 'SIGNED_IN' && session?.user) {
            registerForPushNotifications()
              .then(token => { if (token) return savePushToken(token); })
              .catch(err => console.warn('[App] Push re-register on sign-in:', err));
          }
        });

        // Register for push notifications in the background to avoid blocking startup
        registerForPushNotifications()
          .then(token => {
            if (token) {
              console.log('[App] Push token received');
              savePushToken(token).catch(err => console.warn('[App] Save push token error:', err));
            }
          })
          .catch(err => console.warn('[App] Push registration error:', err));

        // Listen for notifications
        try {
          notificationListener.current = addNotificationReceivedListener((notification) => {
            console.log('Notification received:', notification);
          });
        } catch (notifErr) {
          console.warn('[App] Failed to add notification listener:', notifErr);
        }

        console.log('[App Content] Initialization steps finished');
        const duration = Date.now() - startupTime.current;
        console.log(`[PERF] Initial Boot Logic Finished in ${duration}ms`);
        setIsReady(true);
      } catch (err) {
        console.error('[App Content] Unexpected initialization error:', err);
        setError(err instanceof Error ? err.message : 'Unknown initialization error');
        setIsReady(true);
      }
    }

    initialize();

    // Fallback timer: ensure the app is ready within 5 seconds regardless
    const timer = setTimeout(() => {
      setIsReady(current => {
        if (!current) {
          console.log('[App Content] Initialization timed out - applying fallback ready state');
          return true;
        }
        return current;
      });
    }, 5000);

    return () => {
      clearTimeout(timer);
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
    };
  }, []);

  // Configure React Native Paper theme to match our design system
  const paperTheme = {
    ...(isDark ? MD3DarkTheme : MD3LightTheme),
    colors: {
      ...(isDark ? MD3DarkTheme.colors : MD3LightTheme.colors),
      primary: theme.primary,
      secondary: theme.textSecondary,
      background: theme.background,
      surface: theme.backgroundCard,
      error: theme.error,
    },
  };

  // Fade in main app only when splash exit starts — crossfade merges the two screens
  const handleSplashExitStart = useRef(() => {
    Animated.timing(mainAppOpacity, {
      toValue: 1,
      duration: SPLASH_MERGE_FADE_MS,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }).current;

  const mainApp = (
    <Animated.View style={[styles.mainAppWrap, { opacity: mainAppOpacity }]}>
      <PaperProvider theme={paperTheme}>
        <CoachInsightProvider>
          <CoachCharacterProvider>
            <NotificationBannerProvider>
              <AppNavigator />
              <RetentionNudge />
              <AutoNudgeManager />
              <StatusBar
                style={isDark ? "light" : "dark"}
                backgroundColor={theme.background}
              />
            </NotificationBannerProvider>
          </CoachCharacterProvider>
        </CoachInsightProvider>
      </PaperProvider>
    </Animated.View>
  );

  // Root-level safe area: app content is inset so nothing draws under status bar or nav bar.
  // With edgeToEdgeEnabled on Android, insets.bottom can be 0 — use fallback.
  const safeAreaStyle = {
    flex: 1,
    paddingTop: insets.top,
    paddingBottom: bottomInset,
    paddingLeft: insets.left,
    paddingRight: insets.right,
  };

  return (
    <View style={safeAreaStyle}>
      {isReady && mainApp}
      {showSplash && (
        <AnimatedSplashScreen
          isReady={isReady}
          onExitStart={handleSplashExitStart}
          onTransitionComplete={() => setShowSplash(false)}
        />
      )}
    </View>
  );
}

export default function App() {
  console.log('[App] Rendering boot component');

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1, minHeight: '100%', backgroundColor: '#E8EFE8' }}>
        <SafeAreaProvider initialMetrics={initialWindowMetrics} style={{ flex: 1, backgroundColor: '#E8EFE8' }}>
          <AuthProvider>
            <ThemeProvider>
              <AppContent />
            </ThemeProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  mainAppWrap: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
  },
});
