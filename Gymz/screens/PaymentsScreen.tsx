import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  Dimensions,
  Linking,
  Platform,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../services/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { designSystem } from '../theme/designSystem';
import { ScreenHeader } from '../components/ScreenHeader';
import { DynamicBackground } from '../components/dashboard/DynamicBackground';
import { DataMapper } from '../utils/dataMapper';
import {
  fetchGymPricingPlans,
  getMonthsFromPlan,
  type GymPricingPlan,
} from '../services/pricingPlans';
import {
  createClicknPayOrder,
  checkClicknPayStatus,
  convertZmwToUsd,
  getLiveZmwPerUsd,
} from '../services/clicknpay';
import {
  submitPesapalOrder,
  getTransactionStatus,
} from '../services/pesapal';
import { databaseNotificationService, NOTIFICATION_TYPES } from '../services/databaseNotificationService';

const formatKwacha = (amount: number) => {
  const parsed = Number(amount || 0);
  return `K${new Intl.NumberFormat("en-ZM", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(parsed)}`;
};

// Helper function to get current time in UTC+2 (Zambia timezone)
function getCurrentTimeUTCPlus2(): string {
  const now = new Date();
  const utcTime = now.getTime();
  const utcPlus2Time = utcTime + (2 * 60 * 60 * 1000);
  const utcPlus2Date = new Date(utcPlus2Time);
  return utcPlus2Date.toISOString();
}

export default function PaymentsScreen({ navigation }: any) {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [trainers, setTrainers] = useState<any[]>([]);
  const [loadingTrainers, setLoadingTrainers] = useState(false);
  const [gymPlans, setGymPlans] = useState<GymPricingPlan[]>([]);
  const [loadingGymPlans, setLoadingGymPlans] = useState(true);

  // Status check state
  const [checkingStatusId, setCheckingStatusId] = useState<string | null>(null);

  const [paymentForm, setPaymentForm] = useState({
    planId: '',
    amount: '',
    description: '',
    method: '',
    transactionReference: '',
    mobileNumber: '',
    bankName: '',
    accountNumber: '',
    tip: '',
    trainerId: '',
    months: '1',
  });

  useEffect(() => {
    fetchPayments();
  }, [user]);

  useEffect(() => {
    const loadGymPlans = async () => {
      setLoadingGymPlans(true);
      const plans = await fetchGymPricingPlans(user?.gymId || null, user?.accessMode || null);
      setGymPlans(plans);
      setLoadingGymPlans(false);
    };
    loadGymPlans();
  }, [user?.gymId, user?.accessMode]);

  // Real-time listeners for payment updates and notifications
  useEffect(() => {
    if (!user?.id) return;

    // 1. Payment Listener: Refresh list when any of user's payments change (e.g. approved)
    const paymentChannel = (supabase as any)
      .channel(`user-payments-${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'payments',
        filter: `user_id=eq.${user.id}`
      }, (payload: any) => {
        fetchPayments();
      })
      .subscribe();

    // 2. Notification Listener
    const notificationChannel = (supabase as any)
      .channel(`user-notifications-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload: any) => {
        const notif = payload.new;
        if (notif.type === 'payment_approved') {
          fetchPayments();
        }
      })
      .subscribe();

    return () => {
      paymentChannel.unsubscribe();
      notificationChannel.unsubscribe();
    };
  }, [user?.id]);

  // Fetch trainers when tip amount is entered
  useEffect(() => {
    const tipValue = Number(paymentForm.tip);
    if (paymentForm.tip && tipValue > 0 && trainers.length === 0 && !loadingTrainers) {
      fetchTrainers();
    }
    if (!paymentForm.tip || Number(paymentForm.tip) <= 0) {
      setPaymentForm(prev => ({ ...prev, trainerId: '' }));
    }
  }, [paymentForm.tip]);

  const fetchPayments = async () => {
    if (!user?.id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', user.id)
        .order('paid_at', { ascending: false });

      if (error) throw error;
      setPayments(DataMapper.fromDb(data || []));
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchTrainers = async () => {
    if (loadingTrainers) return;
    setLoadingTrainers(true);
    try {
      // @ts-ignore
      const { data, error } = await supabase
        .from('staff')
        .select('id, name, role, avatar, rating')
        .or('status.eq.Active,status.is.null')
        .order('name');

      if (error) {
        setTrainers([]);
        return;
      }
      setTrainers(DataMapper.fromDb(data || []));
    } catch (err: any) {
      setTrainers([]);
    } finally {
      setLoadingTrainers(false);
    }
  };

  const handleAmountSelect = (plan: GymPricingPlan) => {
    setPaymentForm({
      ...paymentForm,
      planId: plan.id,
      amount: plan.price.toString(),
      description: plan.planName,
      months: getMonthsFromPlan(plan).toString(),
    });
  };

  const handleUpdateStatus = async (paymentId: string, reference: string, gateway: 'ClicknPay' | 'Pesapal' | 'Manual' | string) => {
    if (!reference) {
      Alert.alert('Missing Reference', 'A transaction reference is required to verify this payment.');
      return;
    }
    setCheckingStatusId(paymentId);

    try {
      let isSuccess = false;
      let newReference = reference;

      if (gateway === 'Pesapal') {
        const statusResponse = await getTransactionStatus(reference);
        const statusCode = statusResponse.status_code;
        if (statusCode === 1) isSuccess = true;
        else if (statusCode === 2) {
          await (supabase as any).from('payments').update({ status: 'failed', transaction_reference: reference }).eq('id', paymentId);
          Alert.alert('Payment Failed', 'Pesapal rejected the transaction');
          fetchPayments();
          return;
        }
      } else if (gateway === 'ClicknPay') {
        const statusResponse = await checkClicknPayStatus(reference);
        const status = (statusResponse.status || "").toLowerCase();
        if (status === 'success' || status === 'completed') {
          isSuccess = true;
          if (statusResponse.clientReference) newReference = statusResponse.clientReference;
        } else if (status === 'failed') {
          await (supabase as any).from('payments').update({ status: 'failed', transaction_reference: newReference }).eq('id', paymentId);
          Alert.alert('Payment Failed', 'ClicknPay rejected the transaction');
          fetchPayments();
          return;
        }
      } else if (gateway === 'Manual') {
        // For manual, we just update the reference for admin to see
        await (supabase as any).from('payments').update({ transaction_reference: reference, status: 'pending' }).eq('id', paymentId);
        Alert.alert('Reference Received', 'Your reference is pending admin verification');
        fetchPayments();
        setCheckingStatusId(null);
        return;
      }

      if (isSuccess) {
        // 1. Update Reference
        await (supabase as any).from('payments').update(DataMapper.toDb({
          transactionReference: newReference,
          updatedAt: new Date().toISOString()
        })).eq('id', paymentId);

        // 2. Atomic Activation RPC
        const { data: activationResult, error: activationError } = await (supabase as any).rpc('activate_subscription_from_payment', {
          p_payment_id: paymentId
        });

        if (activationError) throw activationError;

        if (activationResult && !activationResult.success) {
          if (activationResult.error === 'Payment already processed') {
            Alert.alert('Already Active', 'This payment was already processed.');
          } else {
            Alert.alert('Activation Issue', activationResult.error || 'Activation failed');
          }
        } else {
          Alert.alert('Payment Confirmed', 'Your membership is now active');
          // Optionally trigger a user profile refresh here if needed
        }
        fetchPayments();
      } else {
        Alert.alert('Status Pending', 'Payment is still pending gateway confirmation.');
      }

    } catch (error: any) {
      console.error('Status Check Error:', error);
      Alert.alert('Status Check Failed', error.message || 'Could not verify status');
    } finally {
      setCheckingStatusId(null);
    }
  };

  const handleSubmitPayment = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'Please log in to make a payment');
      return;
    }

    // 1. Validation 
    if (!paymentForm.planId) {
      Alert.alert('Pricing not available', 'Select a valid gym plan from onboarding pricing before checkout.');
      return;
    }

    const selectedPlan = gymPlans.find(p => p.id === paymentForm.planId);
    if (!selectedPlan) {
      Alert.alert('Pricing not available', 'This plan is no longer available for your gym.');
      return;
    }

    if (!paymentForm.method) {
      Alert.alert('Validation Error', 'Please select a payment method');
      return;
    }

    const amount = Number(paymentForm.amount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Validation Error', 'Amount must be a positive number');
      return;
    }

    const tipAmount = paymentForm.tip ? Number(paymentForm.tip) : 0;
    if (tipAmount > 0 && !paymentForm.trainerId) {
      Alert.alert('Validation Error', 'Please select a trainer to receive your tip');
      return;
    }

    setSubmitting(true);

    try {
      const totalAmount = amount + tipAmount;
      const months = Number(paymentForm.months) || 1;
      let clientReference = "";
      let gatewayPayUrl: string | null = null;

      // 2. Gateway Logic (ClicknPay)
      if (paymentForm.method === 'ClicknPay') {
        const genRef = () => `GYM-${user.id.slice(0, 8)}-${Date.now()}`;
        clientReference = genRef();
        const zmwPerUsd = await getLiveZmwPerUsd();

        const productsList = [
          {
            description: paymentForm.description,
            id: Date.now(),
            price: convertZmwToUsd(amount, zmwPerUsd),
            productName: paymentForm.description,
            quantity: 1,
          }
        ];

        if (tipAmount > 0) {
          productsList.push({
            description: "Trainer Tip",
            id: Date.now() + 1,
            price: convertZmwToUsd(tipAmount, zmwPerUsd),
            productName: "Trainer Tip",
            quantity: 1,
          });
        }

        const orderPayload = {
          channel: "AUTOMATED" as const,
          clientReference,
          currency: "USD",
          customerCharged: true,
          customerPhoneNumber: paymentForm.mobileNumber,
          description: paymentForm.description,
          multiplePayments: false,
          orderYpe: "DYNAMIC" as const,
          productsList,
          publicUniqueId: user.id,
          returnUrl: "https://Gymz.co.zm/member/payments",
        };

        const orderResponse = await createClicknPayOrder(orderPayload);
        gatewayPayUrl = orderResponse.paymeURL || orderResponse.paymeUrl || (orderResponse as any).payme_url || null;
      }

      // 3. Prepare Payment Data (Aligned with latest schema)
      const paymentData = {
        userId: user.id,
        memberId: user.id,
        gymId: user.gymId || undefined,
        planId: selectedPlan.id,
        amount: Number(totalAmount.toFixed(2)),
        description: selectedPlan.planName,
        method: paymentForm.method,
        status: "pending",
        paymentStatus: "pending",
        paidAt: getCurrentTimeUTCPlus2(),
        paymentDate: getCurrentTimeUTCPlus2(),
        months: months,
        mobileNumber: paymentForm.mobileNumber || undefined,
        transactionReference: clientReference || undefined,
        bankName: paymentForm.bankName || undefined,
        accountNumber: paymentForm.accountNumber || undefined,
        tipAmount: tipAmount > 0 ? Number(tipAmount.toFixed(2)) : undefined,
        trainerId: tipAmount > 0 ? paymentForm.trainerId : undefined,
      };

      // 4. Insert with robust error handling
      const { data: inserts, error: insertError } = await (supabase as any)
        .from('payments')
        .insert(DataMapper.toDb(paymentData))
        .select();

      if (insertError) {
        if (insertError.message?.includes('column')) {
          const minimalData = {
            userId: user.id,
            amount: paymentData.amount,
            description: paymentData.description,
            method: paymentData.method,
            status: "pending",
            paidAt: paymentData.paidAt,
          };
          const { data: fallbackInserts, error: fallbackError } = await (supabase as any)
            .from('payments')
            .insert(DataMapper.toDb(minimalData))
            .select();

          if (fallbackError) throw fallbackError;
          if (!fallbackInserts || fallbackInserts.length === 0) throw new Error("Insert returned no data");
        } else {
          throw insertError;
        }
      }

      const insertedPayment = (inserts && inserts[0]) || null;

      // 5. Handle Gateway Redirects
      if (paymentForm.method === 'ClicknPay' && gatewayPayUrl) {
        Linking.openURL(gatewayPayUrl);
      } else if (paymentForm.method === 'Pesapal') {
        const response = await submitPesapalOrder(
          user.id, user.id, paymentForm.mobileNumber || "", totalAmount, "ZMW", paymentForm.description, "https://Gymz.co.zm/member/payments"
        );
        if (insertedPayment) {
          await (supabase as any).from('payments').update(DataMapper.toDb({ transactionReference: response.order_tracking_id })).eq('id', insertedPayment.id);
        }
        Linking.openURL(response.redirect_url);
      }

      // 6. Finalize
      setShowPaymentForm(false);
      setPaymentForm({
        planId: '',
        amount: '',
        description: '',
        method: '',
        transactionReference: '',
        mobileNumber: '',
        bankName: '',
        accountNumber: '',
        tip: '',
        trainerId: '',
        months: '1',
      });
      fetchPayments();

      Alert.alert(
        'Submission Received',
        'Your payment has been logged and is awaiting verification by the gym staff.'
      );

    } catch (err: any) {
      console.error('[PAYMENT_ERROR]', err);
      const msg = err.message || JSON.stringify(err);
      if (msg.includes('row-level security') || msg.includes('policy')) {
        Alert.alert('Security Block', 'A database policy prevented this submission. Please notify the gym administrator.');
      } else {
        Alert.alert('Submission Failed', `System error: ${msg}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPayments();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <DynamicBackground rotationType="fixed" fixedIndex={6} />
      <ScreenHeader title="Payments" onBack={() => navigation.goBack()} showBackButton={true} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Manage Payments</Text>
          <TouchableOpacity onPress={() => setShowPaymentForm(true)}>
            <LinearGradient
              colors={designSystem.colors.gradients.primary}
              style={[styles.addButton, { shadowColor: theme.primary }]}
            >
              <MaterialCommunityIcons name="plus" size={20} color="#FFF" />
              <Text style={styles.addButtonText}>New Payment</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <LinearGradient
          colors={isDark ? ['rgba(30, 41, 59, 0.7)', 'rgba(30, 41, 59, 0.4)'] : [theme.backgroundCard, theme.background]}
          style={[styles.balanceCard, { borderColor: theme.border }]}
        >
          <View>
            <Text style={[styles.balanceLabel, { color: theme.textSecondary }]}>Total Spent</Text>
            <Text style={[styles.balanceValue, { color: theme.text }]}>
              {formatKwacha(payments
                .filter(p => {
                  const s = (p.payment_status || p.status || '').toLowerCase();
                  return ['completed', 'approved', 'success', 'paid'].includes(s);
                })
                .reduce((acc, curr) => acc + (curr.amount || 0), 0))}
            </Text>
          </View>
          <View style={[styles.iconContainer, { backgroundColor: theme.backgroundInput }]}>
            <MaterialCommunityIcons name="wallet" size={32} color={theme.primary} />
          </View>
        </LinearGradient>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>Transaction History</Text>

        {payments.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="credit-card-off" size={48} color={theme.textMuted} />
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>No payments history found</Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {payments.map((payment) => (
              <HistoryItem
                key={payment.id}
                payment={payment}
                onCheckStatus={handleUpdateStatus}
                checkingId={checkingStatusId}
                theme={theme}
                isDark={isDark}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showPaymentForm}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPaymentForm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Make a Payment</Text>
              <TouchableOpacity onPress={() => setShowPaymentForm(false)}>
                <MaterialCommunityIcons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalForm}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{ paddingBottom: 60 }}
            >
              <Text style={[styles.label, { color: theme.text }]}>Select Plan</Text>
              {loadingGymPlans && (
                <ActivityIndicator size="small" color={theme.primary} style={{ marginBottom: 10 }} />
              )}
              {!loadingGymPlans && gymPlans.length === 0 && (
                <Text style={[styles.emptyText, { color: theme.textMuted, marginBottom: 10 }]}>
                  Pricing not available for your gym. Checkout is blocked.
                </Text>
              )}
              <View style={styles.planGrid}>
                {gymPlans.map((plan) => (
                  <TouchableOpacity
                    key={plan.id}
                    style={[
                      styles.planCard,
                      { backgroundColor: theme.backgroundCard, borderColor: theme.border },
                      paymentForm.planId === plan.id && {
                        backgroundColor: isDark ? `${theme.primary}30` : `${theme.primary}15`,
                        borderColor: theme.primary
                      }
                    ]}
                    onPress={() => handleAmountSelect(plan)}
                  >
                    <Text style={[
                      styles.planLabel,
                      { color: theme.textSecondary },
                      paymentForm.planId === plan.id && { color: theme.primary }
                    ]}>
                      {plan.planName}
                    </Text>
                    <Text style={[
                      styles.planPrice,
                      { color: theme.text },
                      paymentForm.planId === plan.id && { color: theme.primary }
                    ]}>
                      {formatKwacha(plan.price)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ marginTop: 20 }}>
                <Text style={[styles.label, { color: theme.text }]}>Amount (K) *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.backgroundInput, color: theme.text }]}
                  editable={false}
                  placeholderTextColor={theme.textMuted}
                  keyboardType="numeric"
                  value={paymentForm.amount}
                  onChangeText={() => {}}
                />

                <Text style={[styles.label, { color: theme.text }]}>Description *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.backgroundInput, color: theme.text }]}
                  editable={false}
                  placeholderTextColor={theme.textMuted}
                  value={paymentForm.description}
                  onChangeText={() => {}}
                />

                <Text style={[styles.label, { color: theme.text }]}>Duration (Months)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.backgroundInput, color: theme.text }]}
                  editable={false}
                  placeholderTextColor={theme.textMuted}
                  keyboardType="numeric"
                  value={paymentForm.months}
                  onChangeText={() => {}}
                />
              </View>

              <Text style={[styles.label, { color: theme.text, marginTop: 8 }]}>Payment Method *</Text>
              <View style={styles.methodScroll}>
                <TouchableOpacity
                  style={[
                    styles.methodChip,
                    { backgroundColor: theme.backgroundCard, borderColor: theme.border },
                    paymentForm.method === 'Cash' && { backgroundColor: theme.primary, borderColor: theme.primary }
                  ]}
                  onPress={() => setPaymentForm({ ...paymentForm, method: 'Cash' })}
                >
                  <Text style={[styles.methodText, { color: theme.text }, paymentForm.method === 'Cash' && { color: '#FFF' }]}>Cash</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.methodChip,
                    { backgroundColor: theme.backgroundCard, borderColor: theme.border, opacity: 0.6 }
                  ]}
                  onPress={() => Alert.alert('Coming Soon', 'Pesapal integration is coming soon! Please use Cash for now.')}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.methodText, { color: theme.text }]}>Pesapal</Text>
                    <View style={{ backgroundColor: theme.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }}>SOON</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>

              <Text style={[styles.label, { color: theme.text, marginTop: 8 }]}>Trainer Tip (Optional)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundInput, color: theme.text }]}
                placeholder="Tip Amount (K)"
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
                value={paymentForm.tip}
                onChangeText={t => setPaymentForm({ ...paymentForm, tip: t })}
              />

              {Number(paymentForm.tip) > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.label, { color: theme.textSecondary, fontSize: 12 }]}>
                    {trainers.length > 0 ? 'Select Trainer to receive tip:' : 'No trainers found. Please clear tip or contact staff.'}
                  </Text>
                  <View style={styles.trainerList}>
                    {trainers.map(t => (
                      <TouchableOpacity
                        key={t.id}
                        style={[
                          styles.methodChip,
                          { backgroundColor: theme.backgroundCard, borderColor: theme.border },
                          paymentForm.trainerId === t.id && { backgroundColor: theme.primary, borderColor: theme.primary }
                        ]}
                        onPress={() => setPaymentForm({ ...paymentForm, trainerId: t.id })}
                      >
                        <Text style={[styles.methodText, { color: theme.text }, paymentForm.trainerId === t.id && { color: '#FFF' }]}>{t.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[styles.submitButton, submitting && { opacity: 0.7 }]}
                onPress={handleSubmitPayment}
                disabled={submitting}
              >
                <LinearGradient
                  colors={designSystem.colors.gradients.primary}
                  style={styles.submitGradient}
                >
                  {submitting ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <ActivityIndicator color="#FFF" style={{ marginRight: 8 }} />
                      <Text style={styles.submitText}>Processing...</Text>
                    </View>
                  ) : (
                    <Text style={styles.submitText}>Submit Payment</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const HistoryItem = ({ payment, onCheckStatus, checkingId, theme, isDark }: any) => (
  <View style={[styles.transactionCard, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.8)', borderColor: theme.border }]}>
    <View style={[styles.transactionIconBg, { backgroundColor: theme.backgroundInput }]}>
      <MaterialCommunityIcons
        name={payment.method?.includes('Money') ? 'cellphone' : 'credit-card'}
        size={24}
        color={theme.primary}
      />
    </View>
    <View style={styles.transactionDetails}>
      <Text style={[styles.transactionTitle, { color: theme.text }]}>{payment.description || 'Payment'}</Text>
      <Text style={[styles.transactionDate, { color: theme.textSecondary }]}>
        {payment.paid_at ? format(new Date(payment.paid_at), 'MMM dd, yyyy') : 'Date N/A'}
      </Text>
      {(payment.status === 'pending') && (
        <TouchableOpacity
          onPress={() => {
            if (payment.method === 'ClicknPay' || payment.method === 'Pesapal') {
              onCheckStatus(payment.id, payment.transaction_reference, payment.method);
            } else {
              Alert.prompt(
                'Verify Payment',
                'Enter Transaction ID to verify your payment',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Verify',
                    onPress: (val?: string) => onCheckStatus(payment.id, val || payment.transaction_reference, 'Manual')
                  }
                ],
                'plain-text',
                payment.transaction_reference
              );
            }
          }}
          disabled={checkingId === payment.id}
        >
          <Text style={{ color: theme.primary, fontSize: 12, marginTop: 4 }}>
            {checkingId === payment.id ? 'Checking...' : (payment.method === 'ClicknPay' || payment.method === 'Pesapal' ? 'Check Status' : 'Verify Reference')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
    <View style={styles.transactionRight}>
      <Text style={[styles.transactionAmount, { color: theme.text }]}>
        {formatKwacha(payment.amount || 0)}
      </Text>
      <Text style={[styles.transactionStatus, { color: payment.status === 'completed' ? '#34C759' : (payment.status === 'failed' ? '#FF3B30' : '#FF9500') }]}>
        {payment.status}
      </Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerTitle: { fontSize: 24, fontWeight: 'bold' },
  addButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 4, elevation: 4 },
  addButtonText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  balanceCard: { padding: 24, borderRadius: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, marginBottom: 32 },
  balanceLabel: { fontSize: 14, marginBottom: 4 },
  balanceValue: { fontSize: 32, fontWeight: 'bold' },
  iconContainer: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  listContainer: { gap: 12 },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { marginTop: 16 },
  transactionCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1 },
  transactionIconBg: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  transactionDetails: { flex: 1 },
  transactionTitle: { fontWeight: '600', fontSize: 16, marginBottom: 4 },
  transactionDate: { fontSize: 12 },
  transactionRight: { alignItems: 'flex-end' },
  transactionAmount: { fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
  transactionStatus: { fontSize: 10, textTransform: 'uppercase', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 24, fontWeight: 'bold' },
  modalForm: { flex: 1 },
  label: { marginBottom: 8, fontWeight: '600' },
  input: { height: 56, borderRadius: 16, paddingHorizontal: 16, fontSize: 16, marginBottom: 12 },
  planGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  planCard: { flex: 1, minWidth: '45%', padding: 16, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
  planLabel: { fontSize: 14, fontWeight: '600' },
  planPrice: { fontSize: 16, fontWeight: 'bold', marginTop: 4 },
  methodScroll: { flexDirection: 'row', marginBottom: 16 },
  methodChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, marginRight: 8, marginBottom: 8, height: 44, justifyContent: 'center' },
  methodText: { fontWeight: '600', fontSize: 14 },
  submitButton: { marginTop: 24, borderRadius: 18, overflow: 'hidden' },
  submitGradient: { height: 60, justifyContent: 'center', alignItems: 'center' },
  submitText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  trainerList: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
});
