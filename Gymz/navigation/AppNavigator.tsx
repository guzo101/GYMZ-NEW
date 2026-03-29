import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, AppState, View, ActivityIndicator, StyleSheet, Text, Modal, TouchableOpacity } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme, useNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { BottomTabBar } from '../components/BottomTabBar';
import { supabase } from '../services/supabase';
import {
  addNotificationResponseReceivedListener,
  getLastNotificationResponseAsync,
  getNotificationTapTarget,
  type NotificationTapTarget,
} from '../services/notifications';

const PRE_APP_ROUTES = new Set([
  'AuthEntry', 'Login', 'Signup', 'GymSelection', 'AccessModeSelection', 'EmailVerification', 'ResetPassword',
  'SubscriptionPlans', 'AccessGate', 'HealthMetrics', 'Settings', 'HelpCenter', 'PrivacyPolicy', 'TermsOfService',
]);

import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import { AICoachBubble } from '../components/coachBubble/AICoachBubble';
import { MarketingBubbleProvider } from '../components/coachBubble/MarketingBubbleContext';
import { DualBubbleOverlay } from '../components/coachBubble/drama/DualBubbleOverlay';
import { DramaBridgeProvider } from '../components/coachBubble/drama/DramaBridgeContext';
import { RootNavigationRefProvider } from '../contexts/RootNavigationRefContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function AppTabs() {
  const { isAdmin } = useAuth();
  return (
    <Tab.Navigator
      key={isAdmin ? 'admin-tabs' : 'member-tabs'}
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarPosition: 'bottom',
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Nutrition" getComponent={() => require('../screens/NutritionScreen').default} />
      {isAdmin && (
        <Tab.Screen name="Tribes" getComponent={() => require('../screens/TribesScreen').default} />
      )}
      {!isAdmin && (
        <Tab.Screen name="Progress" getComponent={() => require('../screens/MyReportScreen').default} />
      )}
      <Tab.Screen name="Discover" getComponent={() => require('../screens/DiscoverScreen').default} />
      <Tab.Screen name="Profile" getComponent={() => require('../screens/ProfileScreen').default} />
      <Tab.Screen name="GymCalendar" getComponent={() => require('../screens/GymCalendarScreen').default} options={{ tabBarButton: () => null }} />
      <Tab.Screen name="EventCalendar" getComponent={() => require('../screens/EventCalendarScreen').default} options={{ tabBarButton: () => null }} />
    </Tab.Navigator>
  );
}

function EventTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomTabBar {...props} mode="event" />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarPosition: 'bottom',
      }}
    >
      <Tab.Screen name="EventHome" getComponent={() => require('../screens/EventHomeScreen').default} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="Discover" getComponent={() => require('../screens/DiscoverScreen').default} />
      <Tab.Screen name="Nutrition" getComponent={() => require('../screens/NutritionScreen').default} options={{ tabBarLabel: 'Nutrition' }} />
      <Tab.Screen name="Profile" getComponent={() => require('../screens/ProfileScreen').default} />
      <Tab.Screen name="EventCalendar" getComponent={() => require('../screens/EventCalendarScreen').default} options={{ tabBarButton: () => null }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const navigationRef = useNavigationContainerRef();
  const { user, loading: authLoading, logout, isAdmin, isEventMember, hasGymMapping } = useAuth();
  const { isDark, theme } = useTheme();
  const [messagePopup, setMessagePopup] = useState<{ title: string; body: string } | null>(null);
  const [isNavReady, setIsNavReady] = useState(false);
  const pendingTapRef = useRef<NotificationTapTarget | null>(null);

  // CRITICAL: All hooks must run unconditionally before any early return to avoid "Rendered more hooks than during the previous render."

  function processNotificationTap(target: NotificationTapTarget) {
    if (target.type === 'screen') {
      if (!navigationRef.isReady()) {
        pendingTapRef.current = target;
        return;
      }
      try {
        (navigationRef as any).navigate(target.screen, target.params ?? {});
      } catch (e) {
        console.warn('[AppNavigator] Notification navigate failed:', e);
        setMessagePopup({ title: 'Notification', body: 'Could not open the linked screen.' });
      }
      return;
    }
    setMessagePopup({ title: target.title, body: target.body });
  }

  // Handle notification tap: open intended screen or show message popup when no screen
  useEffect(() => {
    const sub = addNotificationResponseReceivedListener((response) => {
      const content = response.notification.request.content;
      const data = (content.data as Record<string, unknown>) || {};
      const title = typeof content.title === 'string' ? content.title : 'Notification';
      const body = typeof content.body === 'string' ? content.body : '';
      const target = getNotificationTapTarget(data, title, body);
      processNotificationTap(target);
    });
    getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const content = response.notification.request.content;
      const data = (content.data as Record<string, unknown>) || {};
      const title = typeof content.title === 'string' ? content.title : 'Notification';
      const body = typeof content.body === 'string' ? content.body : '';
      const target = getNotificationTapTarget(data, title, body);
      pendingTapRef.current = target;
    });
    return () => sub.remove();
  }, []);

  // Process pending notification tap once navigation is ready (e.g. cold start from tap)
  useEffect(() => {
    if (!isNavReady || !user || !hasGymMapping || !pendingTapRef.current) return;
    const pending = pendingTapRef.current;
    pendingTapRef.current = null;
    processNotificationTap(pending);
  }, [isNavReady, user, hasGymMapping]);

  // When user clicks password reset link in email, app opens with gymz://reset-password#...
  // App.tsx sets session and __pendingResetPassword. Navigate to ResetPassword.
  useEffect(() => {
    const navigateToResetPassword = async () => {
      if (!navigationRef.isReady()) {
        console.log('[AppNavigator] Navigation not ready yet, waiting...');
        return;
      }
      
      const hasFlag = (global as any).__pendingResetPassword;
      if (!hasFlag) {
        return;
      }
      
      // Verify session exists before navigating
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        console.log('[AppNavigator] Session confirmed, navigating to ResetPassword');
        (global as any).__pendingResetPassword = false;
        
        // Use navigate instead of reset to avoid clearing navigation stack unnecessarily
        // But if we're not on ResetPassword, we need to reset
        const currentRoute = navigationRef.getCurrentRoute();
        if (currentRoute?.name !== 'ResetPassword') {
          navigationRef.reset({ 
            index: 0, 
            routes: [{ name: 'ResetPassword' as never }] 
          });
        }
      } else {
        console.log('[AppNavigator] No session yet, will retry...');
        // Retry after a short delay
        setTimeout(() => {
          if ((global as any).__pendingResetPassword && navigationRef.isReady()) {
            navigateToResetPassword();
          }
        }, 500);
      }
    };
    
    const check = () => {
      navigateToResetPassword();
    };
    
    // Check immediately
    check();
    
    // Check after delays to handle timing issues
    const t1 = setTimeout(check, 300);
    const t2 = setTimeout(check, 800);
    const t3 = setTimeout(check, 1500);
    const t4 = setTimeout(check, 2500);
    
    // Also check on app state changes
    const sub = AppState.addEventListener('change', () => {
      if (AppState.currentState === 'active') {
        check();
      }
    });
    
    // Set up an interval to periodically check (in case deep link happens while app is running)
    // Clear it after 10 seconds to avoid running indefinitely
    const intervalId = setInterval(() => {
      if ((global as any).__pendingResetPassword && navigationRef.isReady()) {
        check();
      } else {
        // Flag cleared, stop checking
        clearInterval(intervalId);
      }
    }, 1000);
    
    // Auto-clear interval after 10 seconds
    const intervalTimeout = setTimeout(() => {
      clearInterval(intervalId);
    }, 10000);
    
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(intervalTimeout);
      clearInterval(intervalId);
      sub.remove();
    };
  }, [navigationRef]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const onBack = () => {
      const state = navigationRef.getRootState();
      if (!state?.routes?.length) return false;
      const route = state.routes[state.index ?? 0];
      const topRouteName = (route as any)?.name;
      if (topRouteName === 'Main') return false;
      if (!PRE_APP_ROUTES.has(topRouteName)) return false;
      if (navigationRef.canGoBack()) {
        navigationRef.goBack();
        return true;
      }
      logout();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [navigationRef, logout]);

  // If password reset is pending, always start at ResetPassword regardless of auth state
  // When unauthenticated, start at AuthEntry (log in / create account choice) instead of Login
  const initialRoute = (global as any).__pendingResetPassword
    ? 'ResetPassword'
    : (!user ? 'AuthEntry' : !hasGymMapping ? 'GymSelection' : 'AccessGate');

  // CRITICAL FIX: Prevent navigator remount during password reset
  // During password reset, user gets a session but we must keep navigator in 'unauthenticated' state
  // Check if we're currently on ResetPassword screen with step param (indicates active flow)
  const [isInPasswordReset, setIsInPasswordReset] = React.useState(() => {
    if (!navigationRef.isReady()) return false;
    const route = navigationRef.getCurrentRoute();
    return route?.name === 'ResetPassword' && route?.params && 'step' in (route.params as any);
  });
  
  // Re-check when user changes (this is when session gets set during OTP verification)
  React.useEffect(() => {
    if (!navigationRef.isReady()) return;
    const route = navigationRef.getCurrentRoute();
    const isOnResetPassword = route?.name === 'ResetPassword';
    const hasResetPasswordStep = route?.params && 'step' in (route.params as any);
    setIsInPasswordReset(isOnResetPassword && (hasResetPasswordStep || (global as any).__pendingResetPassword));
  }, [user]); // Re-check when user state changes
  
  // Use a stable key that doesn't change during password reset flow
  // If user exists BUT we're in password reset, keep as 'unauthenticated' to prevent remount
  const navigatorKey = (user && !isInPasswordReset && !(global as any).__pendingResetPassword) ? 'authenticated' : 'unauthenticated';

  // Wait for initial session restoration before showing Login vs main app (after all hooks to satisfy Rules of Hooks).
  if (authLoading) {
    return (
      <View style={[styles.authLoading, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.authLoadingText, { color: theme.textMuted }]}>Loading…</Text>
      </View>
    );
  }

  const MyTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: theme.primary,
      background: theme.background,
      card: theme.backgroundCard,
      text: theme.text,
      border: theme.border,
    },
  };

  return (
    <DramaBridgeProvider>
    <MarketingBubbleProvider>
      <View style={{ flex: 1 }}>
        <NavigationContainer
          ref={navigationRef}
          theme={MyTheme}
          onReady={() => setIsNavReady(true)}
        >
          <RootNavigationRefProvider value={navigationRef}>
          <Stack.Navigator 
            key={navigatorKey} 
            screenOptions={{ 
              headerShown: false,
              contentStyle: {
                paddingTop: 0,
                paddingBottom: 0,
              },
            }} 
            initialRouteName={initialRoute}
          >
            {!user || isInPasswordReset ? (
              <>
                <Stack.Screen name="AuthEntry" getComponent={() => require('../screens/AuthEntryScreen').default} />
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Signup" getComponent={() => require('../screens/SignupScreen').default} />
                <Stack.Screen name="GymSelection" getComponent={() => require('../screens/GymSelectionScreen').default} />
                <Stack.Screen name="AccessModeSelection" getComponent={() => require('../screens/AccessModeSelectionScreen').default} />
                <Stack.Screen name="EmailVerification" getComponent={() => require('../screens/EmailVerificationScreen').default} />
                <Stack.Screen name="ResetPassword" getComponent={() => require('../screens/ResetPasswordScreen').default} />
              </>
            ) : !hasGymMapping ? (
              <>
                <Stack.Screen name="ResetPassword" getComponent={() => require('../screens/ResetPasswordScreen').default} />
                <Stack.Screen name="GymSelection" getComponent={() => require('../screens/GymSelectionScreen').default} initialParams={{ userId: user.id }} />
                <Stack.Screen name="AccessModeSelection" getComponent={() => require('../screens/AccessModeSelectionScreen').default} />
                <Stack.Screen name="SubscriptionPlans" getComponent={() => require('../screens/SubscriptionPlansScreen').default} />
                <Stack.Screen name="Settings" getComponent={() => require('../screens/SettingsScreen').default} />
                <Stack.Screen name="HelpCenter" getComponent={() => require('../screens/HelpCenterScreen').default} />
                <Stack.Screen name="PrivacyPolicy" getComponent={() => require('../screens/PrivacyPolicyScreen').default} />
                <Stack.Screen name="TermsOfService" getComponent={() => require('../screens/TermsOfServiceScreen').default} />
              </>
            ) : (
              <>
                <Stack.Screen name="ResetPassword" getComponent={() => require('../screens/ResetPasswordScreen').default} />
                <Stack.Screen name="AccessGate" getComponent={() => require('../screens/AccessGateScreen').default} />
                <Stack.Screen name="GymSelection" getComponent={() => require('../screens/GymSelectionScreen').default} initialParams={{ userId: user.id }} />
                <Stack.Screen name="AccessModeSelection" getComponent={() => require('../screens/AccessModeSelectionScreen').default} />
                <Stack.Screen name="SubscriptionPlans" getComponent={() => require('../screens/SubscriptionPlansScreen').default} />
                <Stack.Screen name="HealthMetrics" getComponent={() => require('../screens/HealthMetricsScreen').default} initialParams={{ isHardGate: true }} />
                <Stack.Screen name="Main" component={isEventMember ? EventTabs : AppTabs} />
                <Stack.Screen name="Nutrition" getComponent={() => require('../screens/NutritionScreen').default} />
                <Stack.Screen name="Payments" getComponent={() => require('../screens/PaymentsScreen').default} />
                <Stack.Screen name="Settings" getComponent={() => require('../screens/SettingsScreen').default} />
                <Stack.Screen name="HelpCenter" getComponent={() => require('../screens/HelpCenterScreen').default} />
                <Stack.Screen name="PrivacyPolicy" getComponent={() => require('../screens/PrivacyPolicyScreen').default} />
                <Stack.Screen name="TermsOfService" getComponent={() => require('../screens/TermsOfServiceScreen').default} />
                <Stack.Screen name="EditProfile" getComponent={() => require('../screens/EditProfileScreen').default} />
                <Stack.Screen name="AIChat" getComponent={() => require('../screens/AIChatScreen').default} />
                <Stack.Screen name="CommunityChat" getComponent={() => require('../screens/CommunityChatScreen').default} />
                <Stack.Screen name="Leaderboard" getComponent={() => require('../screens/LeaderboardScreen').default} />
                <Stack.Screen name="Attendance" getComponent={() => require('../screens/AttendanceScreen').default} />
                <Stack.Screen name="Achievements" getComponent={() => require('../screens/AchievementsScreen').default} />
                <Stack.Screen name="EventDetail" getComponent={() => require('../screens/EventDetailScreen').default} />
                <Stack.Screen name="EventQRCheckIn" getComponent={() => require('../screens/EventQRCheckInScreen').default} />
                <Stack.Screen name="GymCheckInScanner" getComponent={() => require('../screens/GymCheckInScannerScreen').default} />
                <Stack.Screen name="EventHistory" getComponent={() => require('../screens/EventHistoryScreen').default} />
                <Stack.Screen name="EventChat" getComponent={() => require('../screens/EventChatScreen').default} />
                <Stack.Screen name="WorkoutLog" component={DashboardScreen} />
                {isAdmin && (
                  <>
                    <Stack.Screen name="TribeDashboard" getComponent={() => require('../screens/TribeDashboardScreen').default} />
                    <Stack.Screen name="EventTribes" getComponent={() => require('../screens/EventTribesScreen').default} />
                    <Stack.Screen name="AdminConsole" getComponent={() => require('../screens/AdminConsoleScreen').default} />
                    <Stack.Screen name="AdminPayments" getComponent={() => require('../screens/AdminPaymentsScreen').default} />
                    <Stack.Screen name="AdminMembers" getComponent={() => require('../screens/AdminMembersScreen').default} />
                  </>
                )}
                <Stack.Screen name="BarcodeScanner" getComponent={() => require('../screens/BarcodeScannerScreen').default} />
                <Stack.Screen name="FoodScanner" getComponent={() => require('../screens/FoodScannerScreen').default} />
              </>
            )}
          </Stack.Navigator>
          </RootNavigationRefProvider>
        </NavigationContainer>
        {/* Pre-auth: dual Tyson + Lily drama bubbles */}
        {(!user || isInPasswordReset || !hasGymMapping) && <DualBubbleOverlay />}
        {/* Post-auth: single gender-matched AI coach bubble */}
        {user && !isInPasswordReset && hasGymMapping && <AICoachBubble marketingMode={false} navigationRef={navigationRef} />}
        {/* Message popup when user taps a notification that has no linked screen */}
        <Modal
          visible={messagePopup !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setMessagePopup(null)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.messagePopupOverlay}
            onPress={() => setMessagePopup(null)}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={[styles.messagePopupCard, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}>
              <Text style={[styles.messagePopupTitle, { color: theme.text }]}>{messagePopup?.title ?? 'Notification'}</Text>
              <Text style={[styles.messagePopupBody, { color: theme.textSecondary }]}>{messagePopup?.body ?? ''}</Text>
              <TouchableOpacity
                style={[styles.messagePopupButton, { backgroundColor: theme.primary }]}
                onPress={() => setMessagePopup(null)}
              >
                <Text style={styles.messagePopupButtonText}>OK</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </View>
    </MarketingBubbleProvider>
    </DramaBridgeProvider>
  );
}

const styles = StyleSheet.create({
  authLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  authLoadingText: {
    fontSize: 15,
  },
  messagePopupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  messagePopupCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  messagePopupTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  messagePopupBody: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  messagePopupButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  messagePopupButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
