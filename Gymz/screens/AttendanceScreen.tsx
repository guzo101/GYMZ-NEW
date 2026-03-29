import React, { useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Dimensions,
    Alert,
    Modal,
    TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../services/supabase';
import { designSystem } from '../theme/designSystem';
import { ScreenHeader } from '../components/ScreenHeader';
import { DynamicBackground } from '../components/dashboard/DynamicBackground';
import {
    getCurrentSession,
    getAttendanceHistory,
    calculateStreak,
    getWeeklyCount,
    checkIn,
    checkOut,
    verifyMemberHasAccess,
    AttendanceSession
} from '../services/attendanceService';
import { format, differenceInMinutes } from 'date-fns';

const { width } = Dimensions.get('window');

export default function AttendanceScreen({ navigation }: any) {
    const { user } = useAuth();
    const { theme, isDark } = useTheme();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Personal state
    const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
    const [history, setHistory] = useState<AttendanceSession[]>([]);
    const [stats, setStats] = useState({
        streak: 0,
        totalSessions: 0,
        weeklyCount: 0,
        avgDuration: 0,
    });

    // Admin state
    const [viewMode, setViewMode] = useState<'personal' | 'admin'>('personal');
    const [allActive, setAllActive] = useState<any[]>([]);
    const [allHistory, setAllHistory] = useState<any[]>([]);

    const [sessionDuration, setSessionDuration] = useState(0);
    const [membershipInfo, setMembershipInfo] = useState<{ status?: string; daysRemaining?: number | null; renewalDueDate?: string | null } | null>(null);
    const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
    const [checkoutData, setCheckoutData] = useState({
        notes: '',
        effortLevel: 3,
        focusArea: 'strength',
    });
    const [finishing, setFinishing] = useState(false);

    const fetchData = async () => {
        if (!user?.id) {
            setLoading(false);
            setRefreshing(false);
            return;
        }

        try {
            const promises: Promise<any>[] = [
                getCurrentSession(user.id),
                getAttendanceHistory(user.id, 20),
                calculateStreak(user.id),
                getWeeklyCount(user.id),
                verifyMemberHasAccess(user.id)
            ];

            if (user.role === 'admin') {
                promises.push(require('../services/attendanceService').getAllActiveSessions());
                promises.push(require('../services/attendanceService').getAllAttendanceHistory(30));
            }

            const results = await Promise.all(promises);

            setActiveSession(results[0]);
            setHistory(results[1]);
            const accessResult = results[4];
            if (accessResult?.hasAccess) {
                setMembershipInfo({
                    status: accessResult.membershipStatus ?? undefined,
                    daysRemaining: accessResult.daysRemaining,
                    renewalDueDate: accessResult.renewalDueDate,
                });
            } else {
                setMembershipInfo(null);
            }

            const historyData = results[1];
            const avgDuration = historyData.length > 0
                ? Math.round(historyData.reduce((acc: number, s: any) => acc + (s.durationMinutes || 0), 0) / historyData.length)
                : 0;

            setStats({
                streak: results[2],
                totalSessions: historyData.length,
                weeklyCount: results[3],
                avgDuration
            });

            if (user.role === 'admin') {
                setAllActive(results[5] || []);
                setAllHistory(results[6] || []);
            }
        } catch (error) {
            console.error('Error fetching attendance data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user]);

    useFocusEffect(
        React.useCallback(() => {
            if (user?.id) fetchData();
        }, [user?.id])
    );

    useEffect(() => {
        if (!activeSession) return;
        const interval = setInterval(() => {
            const duration = differenceInMinutes(new Date(), new Date((activeSession as any).checkInTime));
            setSessionDuration(duration);
        }, 10000);
        return () => clearInterval(interval);
    }, [activeSession]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handleManualCheckIn = async () => {
        Alert.alert(
            'Check In',
            'Choose check-in method',
            [
                { text: 'Scan to Check In', onPress: () => navigation.navigate('GymCheckInScanner') },
                {
                    text: 'Location Check-in', onPress: async () => {
                        const result = await checkIn({ userId: user!.id, location: { latitude: 0, longitude: 0 } });
                        if (result.success) {
                            fetchData();
                            Alert.alert('Success', result.message);
                        } else {
                            Alert.alert('Error', result.message);
                        }
                    }
                },
                { text: 'Cancel', style: 'cancel' }
            ]
        );
    };

    const handleCheckOut = async () => {
        if (!activeSession) return;
        setFinishing(true);
        try {
            const result = await checkOut(
                activeSession.id,
                checkoutData.notes,
                checkoutData.effortLevel,
                checkoutData.focusArea
            );
            if (result.success) {
                setCheckoutModalVisible(false);
                fetchData();
                Alert.alert('Success', result.message);
            } else {
                Alert.alert('Error', result.message);
            }
        } catch (error) {
            console.error('Checkout error:', error);
            Alert.alert('Error', 'Failed to finish session');
        } finally {
            setFinishing(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <DynamicBackground rotationType="fixed" fixedIndex={1} />
            <ScreenHeader
                title="Attendance"
                rightElement={
                    user?.role === 'admin' ? (
                        <View style={[styles.adminToggle, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                            <TouchableOpacity
                                style={[styles.toggleBtn, viewMode === 'personal' && { backgroundColor: theme.primary }]}
                                onPress={() => setViewMode('personal')}
                            >
                                <MaterialCommunityIcons name="account" size={18} color={viewMode === 'personal' ? '#FFF' : theme.textSecondary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.toggleBtn, viewMode === 'admin' && { backgroundColor: theme.primary }]}
                                onPress={() => setViewMode('admin')}
                            >
                                <MaterialCommunityIcons name="shield-account" size={18} color={viewMode === 'admin' ? '#FFF' : theme.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.infoButton} onPress={() => Alert.alert('Attendance & Consistency', 'Build consistent gym habits. Coach will keep you accountable and celebrate your wins. 💙')}>
                            <MaterialCommunityIcons name="information-outline" size={24} color={theme.text} />
                        </TouchableOpacity>
                    )
                }
            />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
            >
                {viewMode === 'personal' ? (
                    <>
                        {/* Stats Row */}
                        <View style={styles.statsGrid}>
                            <View style={[styles.statCard, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.8)', borderColor: theme.border }]}>
                                <MaterialCommunityIcons name="fire" size={24} color="#F59E0B" />
                                <Text style={[styles.statValue, { color: theme.text }]}>{stats.streak}</Text>
                                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Day Streak</Text>
                            </View>
                            <View style={[styles.statCard, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.8)', borderColor: theme.border }]}>
                                <MaterialCommunityIcons name="calendar-check" size={24} color="#34D399" />
                                <Text style={[styles.statValue, { color: theme.text }]}>{stats.weeklyCount}</Text>
                                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>This Week</Text>
                            </View>
                            <View style={[styles.statCard, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.8)', borderColor: theme.border }]}>
                                <MaterialCommunityIcons name="clock-outline" size={24} color="#60A5FA" />
                                <Text style={[styles.statValue, { color: theme.text }]}>{stats.avgDuration}m</Text>
                                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Avg Session</Text>
                            </View>
                        </View>

                        {membershipInfo && (
                            <View style={[styles.membershipCard, { backgroundColor: `${theme.primary}12`, borderColor: `${theme.primary}30` }]}>
                                <View style={styles.membershipRow}>
                                    <MaterialCommunityIcons name="shield-check" size={20} color={theme.primary} />
                                    <Text style={[styles.membershipLabel, { color: theme.textSecondary }]}>Membership</Text>
                                    <Text style={[styles.membershipValue, { color: theme.text }]}>
                                        {membershipInfo.status ? String(membershipInfo.status).charAt(0).toUpperCase() + String(membershipInfo.status).slice(1).toLowerCase() : 'Active'}
                                    </Text>
                                </View>
                                {membershipInfo.daysRemaining != null && (
                                    <View style={styles.membershipRow}>
                                        <MaterialCommunityIcons name="calendar-clock" size={20} color={theme.primary} />
                                        <Text style={[styles.membershipLabel, { color: theme.textSecondary }]}>Access</Text>
                                        <Text style={[styles.membershipValue, { color: theme.primary, fontWeight: '700' }]}>
                                            {membershipInfo.daysRemaining === 0 ? 'Renews today' : membershipInfo.daysRemaining === 1 ? '1 day left' : `${membershipInfo.daysRemaining} days left`}
                                        </Text>
                                    </View>
                                )}
                                {membershipInfo.renewalDueDate && (
                                    <View style={styles.membershipRow}>
                                        <MaterialCommunityIcons name="calendar" size={20} color={theme.primary} />
                                        <Text style={[styles.membershipLabel, { color: theme.textSecondary }]}>Due</Text>
                                        <Text style={[styles.membershipValue, { color: theme.text }]}>{format(new Date(membershipInfo.renewalDueDate), 'MMM d, yyyy')}</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {activeSession ? (
                            <LinearGradient colors={[`${theme.primary}25`, `${theme.primary}05`]} style={[styles.activeCard, { borderColor: `${theme.primary}50` }]}>
                                <View style={styles.cardHeader}>
                                    <View style={[styles.activeIcon, { backgroundColor: `${theme.primary}20` }]}>
                                        <MaterialCommunityIcons name="timer" size={24} color={theme.primary} />
                                    </View>
                                    <View>
                                        <Text style={[styles.cardTitle, { color: theme.primary }]}>Active Session</Text>
                                        <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>Keep going, you're doing great!</Text>
                                    </View>
                                </View>
                                <View style={[styles.timerRow, { backgroundColor: `${theme.background}50` }]}>
                                    <View style={styles.timerItem}>
                                        <Text style={[styles.timerLabel, { color: theme.textSecondary }]}>Duration</Text>
                                        <Text style={[styles.timerValue, { color: theme.text }]}>{sessionDuration} min</Text>
                                    </View>
                                    <View style={[styles.timerDivider, { backgroundColor: theme.border }]} />
                                    <View style={styles.timerItem}>
                                        <Text style={[styles.timerLabel, { color: theme.textSecondary }]}>Started At</Text>
                                        <Text style={[styles.timerValue, { color: theme.text }]}>{format(new Date((activeSession as any).checkInTime), 'h:mm a')}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={[styles.checkoutBtn, { backgroundColor: theme.primary }]}
                                    onPress={() => setCheckoutModalVisible(true)}
                                >
                                    <Text style={styles.checkoutBtnText}>Finish Workout</Text>
                                </TouchableOpacity>
                            </LinearGradient>
                        ) : (
                            <TouchableOpacity style={[styles.checkInCta, { backgroundColor: theme.backgroundCard }]} onPress={handleManualCheckIn}>
                                <LinearGradient colors={[theme.primary, theme.primaryDark || theme.primary]} style={styles.ctaGradient}>
                                    <MaterialCommunityIcons name="qrcode-scan" size={32} color="#FFF" />
                                    <Text style={styles.ctaTitle}>Check In to Gym</Text>
                                    <Text style={styles.ctaSubtitle}>Scan gym or event QR • or use location</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        )}

                        <View style={styles.historyHeader}>
                            <Text style={[styles.historyTitle, { color: theme.text }]}>Recent History</Text>
                        </View>

                        {history.length > 0 ? (
                            history.map((session, index) => (
                                <View key={session.id || index} style={[styles.historyItem, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}>
                                    <View style={[styles.historyDateBox, { borderRightColor: theme.border }]}>
                                        <Text style={[styles.historyDateDay, { color: theme.text }]}>{format(new Date((session as any).checkInTime), 'dd')}</Text>
                                        <Text style={[styles.historyDateMonth, { color: theme.textSecondary }]}>{format(new Date((session as any).checkInTime), 'MMM').toUpperCase()}</Text>
                                    </View>
                                    <View style={styles.historyInfo}>
                                        <Text style={[styles.historyStatus, { color: theme.text }]}>
                                            {session.status === 'session_confirmed' ? 'Full Session' : 'Short Session'}
                                        </Text>
                                        <Text style={[styles.historyTime, { color: theme.textSecondary }]}>
                                            {format(new Date((session as any).checkInTime), 'h:mm a')} • {(session as any).durationMinutes || 0} min
                                        </Text>
                                    </View>
                                    <View style={[styles.statusBadge, session.status === 'session_confirmed' ? styles.statusConfirmed : styles.statusShort]}>
                                        <MaterialCommunityIcons
                                            name={session.status === 'session_confirmed' ? "check-circle" : "alert-circle"}
                                            size={16}
                                            color={session.status === 'session_confirmed' ? "#34D399" : "#FBBF24"}
                                        />
                                    </View>
                                </View>
                            ))
                        ) : (
                            <View style={styles.emptyState}>
                                <MaterialCommunityIcons name="history" size={48} color={theme.textMuted} />
                                <Text style={[styles.emptyText, { color: theme.textMuted }]}>No attendance records found</Text>
                            </View>
                        )}
                    </>
                ) : (
                    <>
                        <View style={styles.historyHeader}>
                            <Text style={[styles.historyTitle, { color: theme.text }]}>Live Gym Traffic</Text>
                            <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                                <Text style={styles.badgeText}>{allActive.length} Active</Text>
                            </View>
                        </View>

                        {allActive.length > 0 ? (
                            allActive.map((session) => (
                                <View key={session.id} style={[styles.historyItem, { backgroundColor: theme.backgroundCard, borderColor: theme.primary + '40', borderLeftWidth: 4, borderLeftColor: theme.primary }]}>
                                    <View style={styles.memberAvatar}>
                                        <Text style={{ color: theme.primary, fontWeight: 'bold' }}>
                                            {(session.user?.firstName?.[0] || 'U').toUpperCase()}
                                        </Text>
                                    </View>
                                    <View style={styles.historyInfo}>
                                        <Text style={[styles.historyStatus, { color: theme.text }]}>
                                            {session.user?.firstName} {session.user?.lastName}
                                        </Text>
                                        <Text style={[styles.historyTime, { color: theme.textSecondary }]}>
                                            Started {format(new Date((session as any).checkInTime), 'h:mm a')}
                                        </Text>
                                    </View>
                                    <MaterialCommunityIcons name="timer-outline" size={20} color={theme.primary} />
                                </View>
                            ))
                        ) : (
                            <View style={styles.emptyState}>
                                <MaterialCommunityIcons name="account-group-outline" size={48} color={theme.textMuted} />
                                <Text style={[styles.emptyText, { color: theme.textMuted }]}>No one is currently checked in</Text>
                            </View>
                        )}

                        <View style={[styles.historyHeader, { marginTop: 25 }]}>
                            <Text style={[styles.historyTitle, { color: theme.text }]}>Global History</Text>
                        </View>

                        {allHistory.map((session, index) => (
                            <View key={session.id || index} style={[styles.historyItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderColor: theme.border }]}>
                                <View style={styles.memberAvatarSmall}>
                                    <Text style={{ fontSize: 10, color: theme.textSecondary }}>
                                        {(session.user?.firstName?.[0] || 'U').toUpperCase()}
                                    </Text>
                                </View>
                                <View style={styles.historyInfo}>
                                    <Text style={[styles.historyStatus, { color: theme.text, fontSize: 14 }]}>
                                        {session.user?.firstName} {session.user?.lastName}
                                    </Text>
                                    <Text style={[styles.historyTime, { color: theme.textSecondary, fontSize: 11 }]}>
                                        {format(new Date((session as any).checkInTime), 'MMM d, h:mm a')} • {(session as any).durationMinutes || 0}m
                                    </Text>
                                </View>
                                <View style={[styles.statusBadge, session.status === 'session_confirmed' ? styles.statusConfirmed : styles.statusShort]}>
                                    <MaterialCommunityIcons
                                        name={session.status === 'session_confirmed' ? "check-circle" : "alert-circle"}
                                        size={14}
                                        color={session.status === 'session_confirmed' ? "#34D399" : "#FBBF24"}
                                    />
                                </View>
                            </View>
                        ))}
                    </>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>

            <Modal
                visible={checkoutModalVisible}
                transparent={true}
                animationType="slide"
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>Finish Workout</Text>
                            <TouchableOpacity onPress={() => setCheckoutModalVisible(false)}>
                                <MaterialCommunityIcons name="close" size={24} color={theme.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <Text style={[styles.label, { color: theme.textSecondary }]}>Focus Area</Text>
                            <View style={styles.focusGrid}>
                                {['strength', 'cardio', 'flexibility', 'yoga'].map(area => (
                                    <TouchableOpacity
                                        key={area}
                                        style={[
                                            styles.focusChip,
                                            { backgroundColor: theme.backgroundCard, borderColor: theme.border },
                                            checkoutData.focusArea === area && { backgroundColor: theme.primary, borderColor: theme.primary }
                                        ]}
                                        onPress={() => setCheckoutData(prev => ({ ...prev, focusArea: area }))}
                                    >
                                        <Text style={[
                                            styles.focusText,
                                            { color: theme.textSecondary },
                                            checkoutData.focusArea === area && { color: '#FFF', fontWeight: 'bold' }
                                        ]}>
                                            {area.charAt(0).toUpperCase() + area.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={[styles.label, { color: theme.textSecondary }]}>Effort Level (1-5)</Text>
                            <View style={styles.effortRow}>
                                {[1, 2, 3, 4, 5].map(level => (
                                    <TouchableOpacity
                                        key={level}
                                        style={[
                                            styles.effortCircle,
                                            { backgroundColor: theme.backgroundCard, borderColor: theme.border },
                                            checkoutData.effortLevel === level && { backgroundColor: '#34D399', borderColor: '#34D399' }
                                        ]}
                                        onPress={() => setCheckoutData(prev => ({ ...prev, effortLevel: level }))}
                                    >
                                        <Text style={[styles.effortText, { color: theme.text }]}>{level}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={[styles.label, { color: theme.textSecondary }]}>Notes</Text>
                            <TextInput
                                style={[styles.notesInput, { backgroundColor: theme.backgroundInput, color: theme.text, borderColor: theme.border }]}
                                placeholder="How was your workout?"
                                placeholderTextColor={theme.textMuted}
                                multiline
                                numberOfLines={4}
                                value={checkoutData.notes}
                                onChangeText={text => setCheckoutData(prev => ({ ...prev, notes: text }))}
                            />
                        </ScrollView>

                        <TouchableOpacity
                            style={[styles.confirmBtn, { backgroundColor: theme.primary }]}
                            onPress={handleCheckOut}
                            disabled={finishing}
                        >
                            {finishing ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.confirmBtnText}>Confirm Checkout</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    // Header styles removed as ScreenHeader handles it
    infoButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    adminToggle: { flexDirection: 'row', borderRadius: 12, padding: 3, gap: 3 },
    scrollContent: { padding: 20 },
    statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
    statCard: { width: (width - 60) / 3, borderRadius: 16, padding: 15, alignItems: 'center', borderWidth: 1 },
    statValue: { fontSize: 20, fontWeight: 'bold', marginVertical: 4 },
    statLabel: { fontSize: 10, textTransform: 'uppercase' },
    membershipCard: { borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1 },
    membershipRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
    membershipLabel: { flex: 1, fontSize: 14 },
    membershipValue: { fontSize: 14, fontWeight: '600' },
    activeCard: { borderRadius: 24, padding: 20, marginBottom: 24, borderWidth: 1 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 20 },
    activeIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    cardTitle: { fontSize: 18, fontWeight: 'bold' },
    cardSubtitle: { fontSize: 12 },
    timerRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderRadius: 16, padding: 15, marginBottom: 20 },
    timerItem: { alignItems: 'center' },
    timerLabel: { fontSize: 10, textTransform: 'uppercase', marginBottom: 4 },
    timerValue: { fontSize: 16, fontWeight: 'bold' },
    timerDivider: { width: 1, height: 24 },
    checkoutBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    checkoutBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
    checkInCta: { borderRadius: 24, overflow: 'hidden', marginBottom: 24 },
    ctaGradient: { padding: 30, alignItems: 'center', gap: 10 },
    ctaTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFF' },
    ctaSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
    historyHeader: { marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    historyTitle: { fontSize: 18, fontWeight: 'bold' },
    historyItem: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 12, marginBottom: 12, borderWidth: 1 },
    historyDateBox: { width: 50, alignItems: 'center', borderRightWidth: 1, paddingRight: 10 },
    historyDateDay: { fontSize: 18, fontWeight: 'bold' },
    historyDateMonth: { fontSize: 10 },
    historyInfo: { flex: 1, paddingLeft: 15 },
    historyStatus: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
    historyTime: { fontSize: 12 },
    statusBadge: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    statusConfirmed: { backgroundColor: 'rgba(52, 211, 153, 0.1)' },
    statusShort: { backgroundColor: 'rgba(251, 191, 36, 0.1)' },
    emptyState: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { marginTop: 10 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, maxHeight: '80%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 22, fontWeight: 'bold' },
    modalBody: { marginBottom: 20 },
    label: { fontSize: 16, marginBottom: 12, marginTop: 10 },
    focusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
    focusChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
    focusText: { fontSize: 14 },
    effortRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    effortCircle: { width: 45, height: 45, borderRadius: 23, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
    effortText: { fontSize: 16, fontWeight: 'bold' },
    notesInput: { borderRadius: 16, padding: 15, textAlignVertical: 'top', height: 100, borderWidth: 1 },
    confirmBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 10 },
    confirmBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
    toggleBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
    memberAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(59, 130, 246, 0.1)', justifyContent: 'center', alignItems: 'center' },
    memberAvatarSmall: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(150, 150, 150, 0.1)', justifyContent: 'center', alignItems: 'center' },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    badgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' }
});
