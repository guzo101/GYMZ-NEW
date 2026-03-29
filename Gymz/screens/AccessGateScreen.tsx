/**
 * Access Gate — single responsibility: check membership (single source of truth) and route correctly.
 * No reuse of old Pending Approval logic. Strict state machine; all transitions use replace.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { ScreenHeader } from '../components/ScreenHeader';
import { DynamicBackground } from '../components/dashboard/DynamicBackground';
import { fetchMembershipForGate, syncUserGymContextFromMembership, type MembershipForGate } from '../services/membershipGate';

const REFRESH_INTERVAL_MS = 10000;

type GateDecision =
  | 'no_membership'
  | 'pending'
  | 'rejected'
  | 'to_calibration'
  | 'to_main';

function decideRoute(m: MembershipForGate | null): GateDecision {
  if (!m) return 'no_membership';
  const status = (m.membership_status || '').toLowerCase();
  if (status === 'rejected') return 'rejected';
  if (status === 'pending' || m.approved === false) return 'pending';
  if (status === 'active' && m.approved === true) {
    return m.calibration_completed ? 'to_main' : 'to_calibration';
  }
  return 'pending';
}

export default function AccessGateScreen() {
  const { user, logout, refreshUser } = useAuth();
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const [membership, setMembership] = useState<MembershipForGate | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  const gymId = user?.gymId ?? null;
  const accessMode = user?.accessMode ?? 'gym_access';

  const fetchAndApply = useCallback(async () => {
    if (!user?.id || !gymId) {
      setMembership(null);
      setLoading(false);
      return;
    }
    const m = await fetchMembershipForGate(user.id, gymId, accessMode);
    if (!mounted.current) return;
    setMembership(m);
    setLoading(false);
    setRefreshing(false);

    // If membership found for different gym (multi-gym, stale context), sync user context first
    if (m?.gym_context_mismatch && m.gym_id && m.access_mode) {
      const sync = await syncUserGymContextFromMembership(user.id, m.gym_id, m.access_mode);
      if (sync.success) {
        await refreshUser();
        if (!mounted.current) return;
      }
    }

    const decision = decideRoute(m);
    // Observability: log on every refresh cycle (including paid-user misrouting for monitoring)
    const isPaidActive = m && m.membership_status === 'active' && m.approved;
    if (isPaidActive && decision === 'no_membership') {
      console.error('[AccessGate] MISROUTE: Paid user routed to payment/gym-selection', {
        user_id: user.id,
        gym_id: gymId,
        membership_id: m?.id,
        membership_status: m?.membership_status,
        entitlement_response: m,
        timestamp: new Date().toISOString(),
      });
    }
    console.log('[AccessGate]', {
      membership_status: m?.membership_status ?? 'null',
      approved: m?.approved ?? 'null',
      paid_at: m?.paid_at ?? 'null',
      unique_member_id: m?.unique_member_id ?? 'null',
      calibration_completed: m?.calibration_completed ?? 'null',
      gym_context_mismatch: m?.gym_context_mismatch ?? 'null',
      final_routing_decision: decision,
    });

    if (decision === 'no_membership') {
      navigation.replace('GymSelection');
      return;
    }
    if (decision === 'to_calibration') {
      await refreshUser();
      navigation.replace('HealthMetrics', { isHardGate: true });
      return;
    }
    if (decision === 'to_main') {
      await refreshUser();
      navigation.replace('Main');
      return;
    }
  }, [user?.id, gymId, accessMode, navigation, refreshUser]);

  useEffect(() => {
    mounted.current = true;
    fetchAndApply();
    const interval = setInterval(fetchAndApply, REFRESH_INTERVAL_MS);
    return () => {
      mounted.current = false;
      clearInterval(interval);
    };
  }, [fetchAndApply]);

  const onManualRefresh = () => {
    setRefreshing(true);
    refreshUser().then(() => fetchAndApply());
  };

  if (!user) return null;

  if (!gymId) {
    navigation.replace('GymSelection');
    return null;
  }

  const decision = decideRoute(membership);
  const isPending = decision === 'pending';
  const isRejected = decision === 'rejected';

  if (loading && !membership) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <StatusBar style="light" translucent />
        <DynamicBackground rotationType="fixed" fixedIndex={2} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Checking access...</Text>
        </View>
      </View>
    );
  }

  if (decision === 'no_membership' || decision === 'to_calibration' || decision === 'to_main') {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <StatusBar style="light" translucent />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style="light" translucent />
      <DynamicBackground rotationType="fixed" fixedIndex={2} />
      <BlurView intensity={Platform.OS === 'ios' ? 40 : 100} tint="dark" style={StyleSheet.absoluteFill}>
        <ScreenHeader
          title={isRejected ? 'Action Required' : 'Access Gate'}
          showBackButton={false}
          rightElement={
            <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
              <MaterialCommunityIcons name="logout" size={20} color={theme.error} />
              <Text style={{ color: theme.error, fontWeight: '700' }}>Logout</Text>
            </TouchableOpacity>
          }
        />
        <View style={styles.content}>
          <View style={styles.mainContent}>
            <View style={[styles.iconWrap, { borderColor: isRejected ? theme.error + '40' : theme.primary + '40' }]}>
              <MaterialCommunityIcons
                name={isRejected ? 'alert-circle-outline' : 'clock-check-outline'}
                size={60}
                color={isRejected ? theme.error : theme.primary}
              />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>
              {isRejected ? 'Action Required' : 'Waiting for approval'}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {isRejected
                ? 'Payment could not be verified. Try again or contact support.'
                : 'We’ll unlock access once your gym approves. This screen refreshes every 10 seconds.'}
            </Text>
            <View style={[styles.infoCard, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}>
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                {isRejected ? 'Reference or amount may be incorrect.' : 'Usually under 2 hours.'}
              </Text>
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                {isRejected ? 'Message support for help.' : "You'll be notified when approved."}
              </Text>
            </View>
            <Text style={[styles.gateLabel, { color: theme.textMuted }]}>
              Access Gate • membership check
            </Text>
            <TouchableOpacity
              style={[styles.refreshBtn, { backgroundColor: isRejected ? '#6B46C1' : theme.primary }]}
              onPress={onManualRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons
                    name={isRejected ? 'arrow-back' : 'refresh'}
                    size={20}
                    color="#FFF"
                  />
                  <Text style={styles.refreshBtnText}>
                    {isRejected ? 'Back to discovery' : 'Refresh status'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            {isRejected && (
              <TouchableOpacity
                style={[styles.refreshBtn, { backgroundColor: theme.border, marginTop: 12 }]}
                onPress={() => navigation.replace('GymSelection')}
              >
                <Text style={styles.refreshBtnText}>Choose gym again</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16 },
  content: { flex: 1 },
  mainContent: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: Platform.OS === 'ios' ? 24 : 16,
    paddingBottom: 48,
  },
  logoutBtn: { padding: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  infoCard: {
    width: '100%',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    marginBottom: 30,
  },
  infoText: { fontSize: 14 },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 16,
    gap: 10,
    width: '100%',
  },
  refreshBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  gateLabel: { fontSize: 11, marginBottom: 12, letterSpacing: 0.5 },
});
