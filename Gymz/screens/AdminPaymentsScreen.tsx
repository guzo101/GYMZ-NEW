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
    Dimensions
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
import { hapticService } from '../services/hapticService';

const { width } = Dimensions.get('window');

const currency = new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

export default function AdminPaymentsScreen({ navigation }: any) {
    const { user } = useAuth();
    const { theme, isDark } = useTheme();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [payments, setPayments] = useState<any[]>([]);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        if (user && user.role?.toLowerCase() !== 'admin') {
            navigation.goBack();
            return;
        }
        fetchPendingPayments();
    }, [user]);

    const fetchPendingPayments = async () => {
        try {
            const { data, error } = await supabase
                .from('payments')
                .select(`
                    *,
                    user:users(
                        id,
                        first_name,
                        last_name,
                        email,
                        membership_status
                    )
                `)
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPayments(data || []);
        } catch (error) {
            console.error('Error fetching pending payments:', error);
            Alert.alert('Error', 'Failed to load pending payments.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleApprove = async (payment: any) => {
        setProcessingId(payment.id);
        hapticService.medium();
        try {
            // Call the atomic activation function (Ledger-Based)
            const { data, error } = await (supabase as any).rpc('activate_subscription_from_payment', {
                p_payment_id: payment.id,
                p_admin_id: (await supabase.auth.getUser()).data.user?.id
            });

            if (error) throw error;

            const resData = data as any;
            if (resData && !resData.success) {
                throw new Error(resData.error || 'Activation failed');
            }

            hapticService.success();
            Alert.alert('Success', `Payment approved and subscription activated.\nNew Expiry: ${format(new Date(resData.new_expiry), 'MMM dd, yyyy')}`);
            fetchPendingPayments();
        } catch (error: any) {
            console.error('Approval error:', error);
            Alert.alert('Error', 'Failed to approve payment: ' + (error.message || error.error || JSON.stringify(error)));
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (payment: any) => {
        Alert.alert(
            'Reject Payment',
            'Are you sure you want to reject this payment? This will mark it as failed.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reject',
                    style: 'destructive',
                    onPress: async () => {
                        setProcessingId(payment.id);
                        hapticService.medium();
                        try {
                            const { error: updateError } = await (supabase as any)
                                .from('payments')
                                .update({
                                    status: 'failed',
                                    payment_status: 'failed'
                                } as any)
                                .eq('id', payment.id);

                            if (updateError) throw updateError;

                            // Also update user membership status to 'Rejected'
                            await (supabase as any)
                                .from('users')
                                .update({ membership_status: 'Rejected' } as any)
                                .eq('id', payment.user_id);

                            hapticService.success();
                            fetchPendingPayments();
                        } catch (error: any) {
                            Alert.alert('Error', 'Failed to reject payment.');
                        } finally {
                            setProcessingId(null);
                        }
                    }
                }
            ]
        );
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchPendingPayments();
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <DynamicBackground rotationType="fixed" fixedIndex={3} />
            <ScreenHeader title="Pending Payments" />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
            >
                {loading ? (
                    <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
                ) : payments.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialCommunityIcons name="check-all" size={64} color={theme.textMuted} />
                        <Text style={[styles.emptyText, { color: theme.textMuted }]}>No pending payments to review</Text>
                    </View>
                ) : (
                    payments.map((payment) => (
                        <View key={payment.id} style={[styles.paymentCard, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : '#FFF', borderColor: theme.border }]}>
                            <View style={styles.cardHeader}>
                                <View>
                                    <Text style={[styles.userName, { color: theme.text }]}>
                                        {payment.user?.first_name} {payment.user?.last_name}
                                    </Text>
                                    <Text style={[styles.userEmail, { color: theme.textSecondary }]}>{payment.user?.email}</Text>
                                </View>
                                <Text style={[styles.amount, { color: theme.primary }]}>{currency.format(payment.amount || 0)}</Text>
                            </View>

                            <View style={[styles.divider, { backgroundColor: theme.border }]} />

                            <View style={styles.detailsGrid}>
                                <DetailItem label="Method" value={payment.method} theme={theme} />
                                <DetailItem label="Ref" value={payment.transaction_reference || 'N/A'} theme={theme} />
                                <DetailItem label="Phone" value={payment.mobile_number || 'N/A'} theme={theme} />
                                <DetailItem label="Months" value={payment.months || '1'} theme={theme} />
                            </View>

                            {payment.description && (
                                <Text style={[styles.description, { color: theme.textSecondary }]}>
                                    Note: {payment.description}
                                </Text>
                            )}

                            <View style={styles.actionRow}>
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.rejectBtn, { borderColor: '#EF4444' }]}
                                    onPress={() => handleReject(payment)}
                                    disabled={processingId === payment.id}
                                >
                                    <Text style={[styles.btnText, { color: '#EF4444' }]}>Reject</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.approveBtn, { backgroundColor: theme.primary }]}
                                    onPress={() => handleApprove(payment)}
                                    disabled={processingId === payment.id}
                                >
                                    {processingId === payment.id ? (
                                        <ActivityIndicator size="small" color="#FFF" />
                                    ) : (
                                        <Text style={[styles.btnText, { color: '#FFF' }]}>Approve</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const DetailItem = ({ label, value, theme }: any) => (
    <View style={styles.detailItem}>
        <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{label}</Text>
        <Text style={[styles.detailValue, { color: theme.text }]} numberOfLines={1}>{value}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: 20 },
    emptyState: { alignItems: 'center', marginTop: 100 },
    emptyText: { marginTop: 16, fontSize: 16 },
    paymentCard: { borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, elevation: 2 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
    userName: { fontSize: 18, fontWeight: '700' },
    userEmail: { fontSize: 12, marginTop: 2 },
    amount: { fontSize: 20, fontWeight: '800' },
    divider: { height: 1, marginBottom: 15, opacity: 0.5 },
    detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginBottom: 15 },
    detailItem: { width: (width - 100) / 2 },
    detailLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
    detailValue: { fontSize: 14, fontWeight: '600' },
    description: { fontSize: 13, fontStyle: 'italic', marginBottom: 20 },
    actionRow: { flexDirection: 'row', gap: 12 },
    actionBtn: { flex: 1, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    rejectBtn: { borderWidth: 1 },
    approveBtn: {},
    btnText: { fontSize: 15, fontWeight: 'bold' }
});
