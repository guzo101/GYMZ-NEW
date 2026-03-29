// Forced Cache Bust: 2026-01-18 T22:15
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    Platform,
    SafeAreaView,
    Linking,
    Modal,
    Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../services/supabase';
import { designSystem } from '../theme/designSystem';
import { ScreenHeader } from '../components/ScreenHeader';
import { DynamicBackground } from '../components/dashboard/DynamicBackground';
import {
    PLATFORM_BENEFITS,
    fetchGymPricingPlans,
    getMonthsFromPlan,
    getPlanSubtitle,
    type GymPricingPlan,
} from '../services/pricingPlans';

// Helper for currency formatting
const formatCurrency = (amount: number) => {
    const parsed = Number(amount || 0);
    return `K${new Intl.NumberFormat("en-ZM", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(parsed)}`;
};

// Helper for timezone
function getCurrentTimeUTCPlus2(): string {
    const now = new Date();
    const utcTime = now.getTime();
    const utcPlus2Time = utcTime + (2 * 60 * 60 * 1000);
    const utcPlus2Date = new Date(utcPlus2Time);
    return utcPlus2Date.toISOString();
}

export default function SubscriptionPlansScreen({ route }: any) {
    const gated = route?.params?.gated || false;
    const navigation = useNavigation<any>();
    const { user, logout, refreshUser, isEventMember, currentGym } = useAuth();
    const { theme, isDark } = useTheme();
    const selectedGymId = route?.params?.gym?.id || user?.gymId || currentGym?.id || null;
    // Event members upgrading: show gym_access plans. Otherwise use route param or user's current access mode.
    const selectedAccessMode = route?.params?.accessMode || (isEventMember ? 'gym_access' : null) || user?.accessMode || null;

    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
    const [gymPlans, setGymPlans] = useState<GymPricingPlan[]>([]);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [tip, setTip] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [mobileNumber, setMobileNumber] = useState('');
    const [transactionReference, setTransactionReference] = useState('');
    const [bankName, setBankName] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    const canGoBack = navigation.canGoBack();
    const selectedPlan = gymPlans.find(p => p.id === selectedPlanId);
    const pricingUnavailable = !loadingPlans && gymPlans.length === 0;

    React.useEffect(() => {
        let mounted = true;
        const loadPlans = async () => {
            setLoadingPlans(true);
            const plans = await fetchGymPricingPlans(selectedGymId, selectedAccessMode);
            if (mounted) {
                setGymPlans(plans);
                if (plans.length === 0) {
                    setSelectedPlanId(null);
                }
            }
            setLoadingPlans(false);
        };
        loadPlans();
        return () => {
            mounted = false;
        };
    }, [selectedGymId, selectedAccessMode]);

    const handleCheckout = async () => {
        if (!selectedPlan || !user?.id) {
            Alert.alert('Selection Required', 'Please select a plan to continue.');
            return;
        }

        /* Removed validations for disabled payment methods */
        if (paymentMethod !== 'Cash') {
            // Fallback safety
            Alert.alert('Restriction', 'Only Cash payments are currently supported.');
            return;
        }

        setSubmitting(true);

        try {
            // STEP 2: Calculation
            const amount = selectedPlan.price;
            const tipAmount = tip ? Number(tip) : 0;
            const totalAmount = amount + tipAmount;
            const monthsValue = getMonthsFromPlan(selectedPlan);
            let clientReference = transactionReference || `SUB-${user.id.slice(0, 8)}-${Date.now()}`;

            const paymentData: any = {
                user_id: user.id,
                member_id: user.id,
                gym_id: selectedGymId || user.gymId || null,
                amount: Number(totalAmount.toFixed(2)),
                description: selectedPlan.planName,
                plan_id: selectedPlan.id,
                method: paymentMethod,
                status: "pending",
                paid_at: getCurrentTimeUTCPlus2(),
                months: monthsValue,
                mobile_number: mobileNumber || null,
                transaction_reference: clientReference,
                tip_amount: tipAmount > 0 ? tipAmount : 0,
                bank_name: null,
                account_number: null,
            };

            // STEP 3: Insertion

            // @ts-ignore
            const { data, error } = await supabase
                .from('payments')
                .insert(paymentData)
                .select();

            if (error) {
                throw error;
            }

            const paymentId = (data as any)?.[0]?.id;
            // STEP 4: user update (HANDLED BY DB TRIGGER)

            // Wait a moment for the DB Trigger (trg_auto_pending_user) to process and Supabase to propagate
            await new Promise(r => setTimeout(r, 2000));

            // Refresh local auth state to catch the 'Pending' status set by the trigger
            await refreshUser();

            // --- PESAPAL / CLICKNPAY FLOW REMOVED (Restricted to Cash) ---

            // Create Notifications - HANDLED BY DB TRIGGER 'on_payment_created_notify_admin'
            // We removed the manual insertion here as it was failing due to RLS (user cannot insert user_id=null)

            // Success feedback
            import('../services/hapticService').then(({ hapticService }) => hapticService.success());

            setShowSuccessModal(true);
            setTimeout(() => {
                setShowSuccessModal(false);
                navigation.replace('AccessGate');
            }, 2500);

        } catch (error: any) {
            console.error('Payment Error:', error);
            const errMsg = error?.message || '';
            if (errMsg.includes('PAYMENT_BLOCKED') || errMsg.includes('already has active membership')) {
                Alert.alert(
                    'Already a Member',
                    'You already have an active membership. Redirecting to your dashboard.',
                    [{ text: 'OK', onPress: () => navigation.replace('AccessGate') }]
                );
                return;
            }
            const errorMsg = errMsg || JSON.stringify(error) || 'An unexpected error occurred';
            Alert.alert('Payment Failed', `Reason: ${errorMsg}\n\nPlease try again or contact support.`);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <DynamicBackground rotationType="fixed" fixedIndex={2} />
            <Modal
                visible={showSuccessModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => {
                    setShowSuccessModal(false);
                    navigation.goBack();
                }}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <View style={{
                        backgroundColor: '#1A202C',
                        width: '100%',
                        maxWidth: 340,
                        borderRadius: 24,
                        padding: 30,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: '#2D3748',
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 10 },
                        shadowOpacity: 0.5,
                        shadowRadius: 20,
                        elevation: 10
                    }}>
                        <View style={{
                            width: 80,
                            height: 80,
                            borderRadius: 40,
                            backgroundColor: 'rgba(72, 187, 120, 0.15)',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginBottom: 20
                        }}>
                            <Ionicons name="checkmark-circle" size={48} color="#48BB78" />
                        </View>

                        <Text style={{ color: '#FFF', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 }}>
                            Payment Submitted!
                        </Text>

                        <Text style={{ color: '#A0AEC0', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 25 }}>
                            {(paymentMethod === 'ClicknPay' || paymentMethod === 'Pesapal')
                                ? "Your payment gateway has opened. Please complete the transaction in your browser."
                                : "Your payment has been sent for approval. You will receive a notification once verified."}
                        </Text>

                        <View style={{ width: '100%', height: 1, backgroundColor: '#2D3748', marginBottom: 20 }} />

                        <View style={{ width: '100%', marginBottom: 25 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                                <Text style={{ color: '#718096', fontSize: 14 }}>Amount</Text>
                                <Text style={{ color: '#FFF', fontSize: 14, fontWeight: 'bold' }}>
                                    {selectedPlan ? formatCurrency(selectedPlan.price + (Number(tip) || 0)) : ''}
                                </Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                                <Text style={{ color: '#718096', fontSize: 14 }}>Method</Text>
                                <Text style={{ color: '#FFF', fontSize: 14, fontWeight: 'bold' }}>{paymentMethod}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ color: '#718096', fontSize: 14 }}>Status</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <View style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: 4,
                                        backgroundColor: (user?.membershipStatus?.toLowerCase() === 'rejected') ? '#EF4444' : '#ECC94B'
                                    }} />
                                    <Text style={{
                                        color: (user?.membershipStatus?.toLowerCase() === 'rejected') ? '#EF4444' : '#ECC94B',
                                        fontSize: 14,
                                        fontWeight: 'bold'
                                    }}>
                                        {user?.membershipStatus || 'Pending'}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <View style={{ gap: 10, width: '100%' }}>
                            <TouchableOpacity
                                style={{
                                    backgroundColor: '#6B46C1',
                                    width: '100%',
                                    paddingVertical: 16,
                                    borderRadius: 16,
                                    flexDirection: 'row',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    gap: 8
                                }}
                                onPress={() => {
                                    setShowSuccessModal(false);
                                    if (canGoBack) {
                                        navigation.goBack();
                                    } else {
                                        navigation.replace('Main');
                                    }
                                }}
                            >
                                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: 'bold' }}>Return to Dashboard</Text>
                                <Ionicons name="arrow-forward" size={20} color="#FFF" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={{
                                    backgroundColor: 'transparent',
                                    width: '100%',
                                    paddingVertical: 12,
                                    borderRadius: 16,
                                    flexDirection: 'row',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    gap: 6,
                                    borderWidth: 1,
                                    borderColor: '#2D3748'
                                }}
                                onPress={() => {
                                    import('../services/hapticService').then(({ hapticService }) => hapticService.light());
                                    refreshUser();
                                }}
                            >
                                <Ionicons name="refresh" size={18} color="#A0AEC0" />
                                <Text style={{ color: '#A0AEC0', fontSize: 14, fontWeight: '600' }}>Refresh Status</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>


            <ScreenHeader
                title="Membership Plans"
                showBackButton={canGoBack}
                rightElement={
                    (!canGoBack || gated) ? (
                        <TouchableOpacity
                            onPress={logout}
                            style={{ padding: 10, flexDirection: 'row', alignItems: 'center', gap: 5 }}
                        >
                            <MaterialCommunityIcons name="logout" size={20} color={theme.error} />
                            <Text style={{ color: theme.error, fontWeight: '700' }}>Logout</Text>
                        </TouchableOpacity>
                    ) : undefined
                }
            />

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {loadingPlans && (
                    <View style={{ paddingVertical: 16 }}>
                        <ActivityIndicator color={theme.primary} />
                    </View>
                )}
                {pricingUnavailable && (
                    <View style={[styles.planCard, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.8)', borderColor: theme.border }]}>
                        <Text style={[styles.planTitle, { color: theme.text }]}>Pricing not available</Text>
                        <Text style={[styles.planSubtitle, { color: theme.textSecondary }]}>
                            This gym has not configured valid onboarding pricing yet. Checkout is blocked.
                        </Text>
                    </View>
                )}

                {/* PV: Grid of Plans */}
                <View style={styles.plansGrid}>
                    {gymPlans.map((plan) => {
                        const isSelected = selectedPlanId === plan.id;
                        const planBenefits = [...PLATFORM_BENEFITS, ...plan.gymInclusions];

                        return (
                            <TouchableOpacity
                                key={plan.id}
                                style={[
                                    styles.planCard,
                                    { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.8)', borderColor: theme.border },
                                    isSelected && { borderColor: theme.primary, borderWidth: 2, backgroundColor: `${theme.primary}05` }
                                ]}
                                activeOpacity={0.9}
                                onPress={() => setSelectedPlanId(plan.id)}
                            >
                                <View style={styles.cardHeader}>
                                    <View>
                                        <Text style={[styles.planTitle, { color: theme.text }]}>{plan.planName}</Text>
                                        <Text style={[styles.planSubtitle, { color: theme.textSecondary }]}>{getPlanSubtitle(plan)}</Text>
                                    </View>
                                    <View style={styles.priceTag}>
                                        <Text style={[styles.amount, { color: theme.primary }]}>
                                            {formatCurrency(plan.price)}
                                        </Text>
                                        <Text style={[styles.period, { color: theme.textMuted }]}>
                                            /tier
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.featuresList}>
                                    {planBenefits.map((feature, idx) => (
                                        <View key={idx} style={styles.listItem}>
                                            <MaterialCommunityIcons
                                                name="check-circle-outline"
                                                size={20}
                                                color={theme.primary}
                                            />
                                            <Text style={[
                                                styles.listItemText,
                                                { color: theme.text },
                                            ]}>
                                                {feature}
                                            </Text>
                                        </View>
                                    ))}
                                </View>

                                <View style={[
                                    styles.selectBtn,
                                    { backgroundColor: theme.backgroundInput },
                                    isSelected && { backgroundColor: theme.primary }
                                ]}>
                                    <Text style={[
                                        styles.selectBtnText,
                                        { color: theme.primary },
                                        isSelected && { color: '#FFF' }
                                    ]}>
                                        {isSelected ? 'Selected' : `Select ${plan.planName}`}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Payment Section - Only show if plan selected */}
                {selectedPlan && (
                    <View style={[styles.paymentContainer, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.8)', marginTop: 30, borderRadius: 24, padding: 20, borderColor: theme.border, borderWidth: 1 }]}>
                        <Text style={[styles.sectionHeader, { color: theme.text }]}>Select Payment Method</Text>

                        <View style={styles.methodsRow}>
                            {/* Cash Option */}
                            <TouchableOpacity
                                style={[
                                    styles.methodItem,
                                    { borderColor: theme.border },
                                    paymentMethod === 'Cash' && { borderColor: theme.primary, backgroundColor: `${theme.primary}10`, borderWidth: 2 }
                                ]}
                                onPress={() => setPaymentMethod('Cash')}
                            >
                                <View style={styles.methodIconBox}>
                                    <Ionicons
                                        name="cash-outline"
                                        size={22}
                                        color={paymentMethod === 'Cash' ? theme.primary : theme.textMuted}
                                    />
                                </View>
                                <View style={styles.methodTextBox}>
                                    <Text style={[styles.methodLabel, { color: theme.textSecondary }, paymentMethod === 'Cash' && { color: theme.primary, fontWeight: 'bold' }]}>
                                        Cash
                                    </Text>
                                    <Text style={[styles.methodSubLabel, { color: theme.textMuted }]}>
                                        Instant Approval
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.methodItem, { borderColor: theme.border, opacity: 0.6 }]}
                                onPress={() => Alert.alert('Coming Soon', 'Credit card and Mobile Money integration is currently under maintenance. Please use Cash.')}
                            >
                                <View style={[styles.comingSoonBadge, { backgroundColor: theme.primary, position: 'absolute', top: -10, right: -10, zIndex: 10 }]}>
                                    <Text style={styles.comingSoonBadgeText}>COMING SOON</Text>
                                </View>

                                <View style={styles.methodIconBox}>
                                    <Ionicons
                                        name="card-outline"
                                        size={22}
                                        color={theme.textMuted}
                                    />
                                </View>
                                <View style={styles.methodTextBox}>
                                    <Text style={[styles.methodSubLabel, { color: theme.textSecondary, fontWeight: 'bold', fontSize: 13, marginTop: 4 }]}>
                                        Cards & Mobile
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {(paymentMethod.includes('Mobile') || paymentMethod.includes('Money') || paymentMethod === 'ClicknPay' || paymentMethod === 'Pesapal') && (
                            <View style={styles.inputGroup}>
                                <Text style={[styles.inputLabel, { color: theme.text }]}>Mobile Number</Text>
                                <TextInput
                                    style={[styles.textInput, { backgroundColor: theme.backgroundInput, color: theme.text, borderColor: theme.border }]}
                                    placeholder="09..."
                                    placeholderTextColor={theme.textMuted}
                                    keyboardType="phone-pad"
                                    value={mobileNumber}
                                    onChangeText={setMobileNumber}
                                />
                            </View>
                        )}

                        {/* Transaction Reference for Manual Methods */}
                        {(paymentMethod.includes('Money') || paymentMethod === 'Bank Transfer') && (
                            <View style={styles.inputGroup}>
                                <Text style={[styles.inputLabel, { color: theme.text }]}>Transaction Reference (from SMS/Receipt)</Text>
                                <TextInput
                                    style={[styles.textInput, { backgroundColor: theme.backgroundInput, color: theme.text, borderColor: theme.border }]}
                                    placeholder="e.g. 84729472"
                                    placeholderTextColor={theme.textMuted}
                                    value={transactionReference}
                                    onChangeText={setTransactionReference}
                                />
                            </View>
                        )}

                        {paymentMethod === 'Bank Transfer' && (
                            <>
                                <View style={styles.inputGroup}>
                                    <Text style={[styles.inputLabel, { color: theme.text }]}>Bank Name</Text>
                                    <TextInput
                                        style={[styles.textInput, { backgroundColor: theme.backgroundInput, color: theme.text, borderColor: theme.border }]}
                                        placeholder="e.g. AtlasMara"
                                        placeholderTextColor={theme.textMuted}
                                        value={bankName}
                                        onChangeText={setBankName}
                                    />
                                </View>
                                <View style={styles.inputGroup}>
                                    <Text style={[styles.inputLabel, { color: theme.text }]}>Your Account Number</Text>
                                    <TextInput
                                        style={[styles.textInput, { backgroundColor: theme.backgroundInput, color: theme.text, borderColor: theme.border }]}
                                        placeholder="e.g. 1029302..."
                                        placeholderTextColor={theme.textMuted}
                                        value={accountNumber}
                                        onChangeText={setAccountNumber}
                                    />
                                </View>
                            </>
                        )}

                        <View style={[styles.tipWrapper, { backgroundColor: theme.backgroundInput, borderColor: theme.border }]}>
                            <View style={styles.tipIcon}>
                                <MaterialCommunityIcons name="hand-heart" size={24} color={theme.primary} />
                            </View>
                            <View style={styles.tipContent}>
                                <Text style={[styles.tipTitle, { color: theme.text }]}>Add Tip for Trainer</Text>
                                <Text style={[styles.tipDesc, { color: theme.textSecondary }]}>Optional appreciation</Text>
                            </View>
                            <View style={styles.tipInputGroup}>
                                <Text style={[styles.currencyPrefix, { color: theme.textSecondary }]}>K</Text>
                                <TextInput
                                    style={[styles.tipInput, { color: theme.text, borderBottomColor: theme.border }]}
                                    placeholder="0"
                                    placeholderTextColor={theme.textMuted}
                                    keyboardType="numeric"
                                    value={tip}
                                    onChangeText={setTip}
                                />
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.checkoutBtn, { backgroundColor: theme.primary }]}
                            onPress={handleCheckout}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <>
                                    <Text style={styles.checkoutBtnText}>
                                        Pay {formatCurrency(selectedPlan.price + (Number(tip) || 0))} & Subscribe
                                    </Text>
                                    <Ionicons name="arrow-forward" size={24} color="#FFF" />
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>

        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingTop: 10,
    },
    // Header handled by component now
    avatarContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 14,
    },

    // Current Plan
    currentPlanCard: {
        borderRadius: 24,
        padding: 24,
        marginTop: 20,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 30,
        elevation: 3,
        position: 'relative',
        overflow: 'hidden',
    },
    currentPlanLeftLine: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 6,
    },
    currentPlanContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    currentPlanHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
    },
    currentPlanTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    activeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    activeBadgeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    featureRow: {
        gap: 8,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    featureText: {
        fontSize: 14,
    },
    currentPlanPriceBlock: {
        alignItems: 'flex-end',
    },
    currentPlanPrice: {
        fontSize: 24,
        fontWeight: '700',
    },
    currentPlanPeriod: {
        fontSize: 12,
    },
    manageBtn: {
        marginTop: 20,
        paddingVertical: 12,
        borderWidth: 1.5,
        borderRadius: 12,
        alignItems: 'center',
    },
    manageBtnText: {
        fontWeight: '700',
        fontSize: 14,
    },

    // Toggle
    toggleContainer: {
        alignItems: 'center',
        marginVertical: 25,
        position: 'relative',
    },
    toggleBg: {
        flexDirection: 'row',
        padding: 4,
        borderRadius: 16,
    },
    toggleItem: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    toggleText: {
        fontSize: 13,
        fontWeight: '600',
    },

    // Grid
    plansGrid: {
        gap: 20,
    },
    planCard: {
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.02,
        shadowRadius: 10,
        elevation: 2,
        position: 'relative',
    },
    popularBadge: {
        position: 'absolute',
        top: -12,
        alignSelf: 'center',
        paddingHorizontal: 16,
        paddingVertical: 4,
        borderRadius: 20,
        zIndex: 10,
    },
    popularBadgeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '700',
    },
    vipBadge: {
        position: 'absolute',
        top: -12,
        right: 20,
        backgroundColor: '#805AD5',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        // borderWidth: 1, // Removed border, using solid background
        // borderColor: 'rgba(214, 188, 250, 0.3)',
        zIndex: 10,
    },
    vipBadgeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    planTitle: {
        fontSize: 22,
        fontWeight: '800',
    },
    textWhite: {
        color: '#FFF',
    },
    planSubtitle: {
        fontSize: 14,
        marginTop: 4,
    },
    priceTag: {
        alignItems: 'flex-end',
    },
    amount: {
        fontSize: 24,
        fontWeight: '800',
    },
    period: {
        fontSize: 12,
    },
    featuresList: {
        gap: 12,
        marginBottom: 24,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    listItemText: {
        fontSize: 14,
    },
    selectBtn: {
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: 'center',
    },
    selectBtnText: {
        fontWeight: '700',
        fontSize: 14,
    },
    // Payment stuff
    paymentContainer: {
        // Handled inline mostly
    },
    sectionHeader: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    methodsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 20,
    },
    methodItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: 20,
        borderWidth: 1.5,
        backgroundColor: 'transparent',
        minHeight: 85,
    },
    methodIconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(107, 70, 193, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    methodTextBox: {
        flex: 1,
        justifyContent: 'center',
    },
    methodLabel: {
        fontSize: 15,
        fontWeight: 'bold',
        marginBottom: 1,
    },
    methodSubLabel: {
        fontSize: 11,
        fontWeight: '500',
        lineHeight: 14,
    },
    badgeLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    comingSoonBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    comingSoonBadgeText: {
        fontSize: 7,
        color: '#FFF',
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    inputGroup: {
        marginBottom: 15,
    },
    inputLabel: {
        fontSize: 14,
        marginBottom: 8,
        fontWeight: '500',
    },
    textInput: {
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        fontSize: 16,
    },
    tipWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderRadius: 24,
        marginBottom: 20,
        borderWidth: 1.5,
        gap: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    tipIcon: {
        //
    },
    tipContent: {
        flex: 1,
    },
    tipTitle: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    tipDesc: {
        fontSize: 12,
    },
    tipInputGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    currencyPrefix: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    tipInput: {
        width: 60,
        borderBottomWidth: 1,
        paddingVertical: 4,
        textAlign: 'center',
        fontSize: 16,
        fontWeight: 'bold',
    },
    checkoutBtn: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 16,
        borderRadius: 16,
        gap: 8,
    },
    checkoutBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
