import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
    RefreshControl,
    Platform
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { designSystem } from '../theme/designSystem';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../services/supabase';
import { hapticService } from '../services/hapticService';
import { DataMapper } from '../utils/dataMapper';

const PLAN_COLORS: any = {
    All: { stroke: "#691754", hex: "#691754", light: "#69175420" },
    Basic: { stroke: "#3b82f6", hex: "#3b82f6", light: "#3b82f620" },
    Couple: { stroke: "#2A4B2A", hex: "#2A4B2A", light: "#2A4B2A20" },
    "Day Pass": { stroke: "#F1C93B", hex: "#F1C93B", light: "#F1C93B20" },
    Family: { stroke: "#f59e0b", hex: "#f59e0b", light: "#f59e0b20" }
};

export default function AdminConsoleScreen({ navigation }: any) {
    const { user } = useAuth();
    const { theme, isDark } = useTheme();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalUsers: 0,
        activeTribes: 0,
        pendingPayments: 0,
        todaysCheckins: 0
    });
    const [revenueData, setRevenueData] = useState<number[]>([]);
    const [membershipMix, setMembershipMix] = useState<{ name: string, value: number }[]>([]);
    const [weeklyTotal, setWeeklyTotal] = useState(0);
    const [announcement, setAnnouncement] = useState('');
    const [isBroadcasting, setIsBroadcasting] = useState(false);

    useEffect(() => {
        if (user && user.role?.toLowerCase() !== 'admin') {
            console.warn('[AdminConsole] Unauthorized access attempt by:', user.id);
            navigation.goBack();
            return;
        }
        fetchAdminStats();
    }, [user]);

    const fetchAdminStats = async () => {
        try {
            setLoading(true);

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const sevenDaysAgo = new Date(today);
            sevenDaysAgo.setDate(today.getDate() - 6);

            // Parallel fetches for efficiency
            const [usersCount, tribesCount, paymentsCount, attendanceCount, revenueRes, allUsersRes] = await Promise.all([
                supabase.from('users').select('*', { count: 'exact', head: true }),
                supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('active', true),
                supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
                supabase.from('attendance_logs').select('*', { count: 'exact', head: true }).gte('checkin_time', today.toISOString()),
                supabase.from('payments')
                    .select('amount, paid_at, membership_type')
                    .eq('status', 'completed')
                    .gte('paid_at', sevenDaysAgo.toISOString()),
                supabase.from('users').select('membership_status, role')
            ]);

            // Process revenue data for chart
            const dailyRevenue = new Array(7).fill(0);
            let total = 0;

            if (revenueRes.data) {
                (revenueRes.data as any[]).forEach((p: any) => {
                    const payDate = new Date(p.paid_at);
                    const diffDays = Math.floor((today.getTime() - payDate.getTime()) / (1000 * 3600 * 24));
                    const index = 6 - diffDays;
                    if (index >= 0 && index < 7) {
                        dailyRevenue[index] += p.amount;
                        total += p.amount;
                    }
                });
            }

            // Process Membership Mix
            const mixMap: any = {};
            if (revenueRes.data) {
                DataMapper.fromDb<any[]>(revenueRes.data as any[]).forEach((p: any) => {
                    const type = p.membershipType || 'Basic';
                    mixMap[type] = (mixMap[type] || 0) + 1;
                });
            }
            // If no payment data, maybe use user statuses? 
            // Let's fallback to current active members
            if (Object.keys(mixMap).length === 0 && allUsersRes.data) {
                DataMapper.fromDb<any[]>(allUsersRes.data).forEach((u: any) => {
                    if (u.role === 'member' && u.membershipStatus === 'Active') {
                        // We don't have types in users table usually, so we'd need another join
                    }
                });
            }

            setStats({
                totalUsers: usersCount.count || 0,
                activeTribes: tribesCount.count || 0,
                pendingPayments: paymentsCount.count || 0,
                todaysCheckins: attendanceCount.count || 0
            });
            setRevenueData(dailyRevenue);
            setWeeklyTotal(total);
            setMembershipMix(Object.entries(mixMap).map(([name, value]: [any, any]) => ({ name, value })));
        } catch (error) {
            console.error('Failed to fetch admin stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleBroadcast = async () => {
        if (!announcement.trim() || !user?.id) return;
        setIsBroadcasting(true);
        hapticService.medium();

        try {
            const { error } = await (supabase as any).from('notice_board').insert({
                user_id: user.id,
                content: announcement,
                sender_type: 'admin'
            });

            if (error) throw error;

            hapticService.success();
            Alert.alert('Broadcast sent', 'Announcement successfully posted to the Community Notice Board.');
            setAnnouncement('');
        } catch (error: any) {
            console.error('Broadcast error:', error);
            Alert.alert('Error', 'Failed to send broadcast: ' + error.message);
        } finally {
            setIsBroadcasting(false);
        }
    };

    const renderStatCard = (label: string, value: string | number, icon: string, color: string) => (
        <View style={[styles.statCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', borderWidth: 1 }]}>
            <LinearGradient colors={[color + '30', color + '10']} style={styles.statIconContainer}>
                <MaterialCommunityIcons name={icon as any} size={24} color={color} />
            </LinearGradient>
            <View>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
                <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
            </View>
        </View>
    );

    const maxRevenue = Math.max(...revenueData, 100);

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: theme.background }]}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchAdminStats} tintColor={theme.primary} />}
        >
            <LinearGradient colors={[PLAN_COLORS.All.hex + '20', 'transparent']} style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <View>
                        <Text style={[styles.title, { color: theme.text }]}>Admin Console</Text>
                        <View style={styles.liveBadge}>
                            <View style={styles.pulseDot} />
                            <Text style={styles.liveBadgeText}>LIVE SYSTEM</Text>
                        </View>
                    </View>
                </View>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>GMS v4.2 • Intelligence Suite</Text>
            </LinearGradient>

            <View style={styles.content}>
                <View style={styles.statsGrid}>
                    {renderStatCard('Community', stats.totalUsers, 'account-group', PLAN_COLORS.Basic.hex)}
                    {renderStatCard('Active Tribes', stats.activeTribes, 'camera-iris', '#10B981')}
                    {renderStatCard('Pending', stats.pendingPayments, 'cash-clock', PLAN_COLORS.Family.hex)}
                    {renderStatCard('Live Traffic', stats.todaysCheckins, 'map-marker-check', PLAN_COLORS.Couple.hex)}
                </View>

                {/* Revenue Insights Card */}
                <View style={[styles.section, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFF', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', borderWidth: 1, borderRadius: 24 }]}>
                    <View style={styles.sectionHeaderRow}>
                        <View>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>Revenue Insights</Text>
                            <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>Financial performance analytics</Text>
                        </View>
                        <MaterialCommunityIcons name="flash" size={24} color={theme.primary} />
                    </View>

                    <View style={styles.chartContainer}>
                        {revenueData.map((val, i) => (
                            <View key={i} style={styles.chartColumn}>
                                <View style={[styles.chartBar, {
                                    height: (val / maxRevenue) * 100,
                                    backgroundColor: i === 6 ? PLAN_COLORS.All.hex : PLAN_COLORS.All.hex + '40'
                                }]} />
                                <Text style={[styles.chartDay, { color: theme.textSecondary }]}>
                                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'][(new Date().getDay() + i + 1) % 7]}
                                </Text>
                            </View>
                        ))}
                    </View>
                    <View style={styles.chartTotalRow}>
                        <Text style={[styles.chartTotalLabel, { color: theme.textSecondary }]}>AGGREGATE 7D</Text>
                        <Text style={[styles.chartTotalValue, { color: theme.text }]}>ZMW {weeklyTotal.toLocaleString()}</Text>
                    </View>
                </View>

                {/* Membership Mix Section */}
                {membershipMix.length > 0 && (
                    <View style={[styles.section, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)', borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', borderWidth: 1 }]}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Membership Mix</Text>
                        <View style={styles.mixGrid}>
                            {membershipMix.map((item, i) => (
                                <View key={i} style={styles.mixItem}>
                                    <View style={[styles.mixIndicator, { backgroundColor: (PLAN_COLORS[item.name] || PLAN_COLORS.Basic).hex }]} />
                                    <View>
                                        <Text style={[styles.mixLabel, { color: (PLAN_COLORS[item.name] || PLAN_COLORS.Basic).hex }]}>{item.name.toUpperCase()}</Text>
                                        <Text style={[styles.mixValue, { color: theme.text }]}>{item.value}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                <View style={[styles.section, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', borderWidth: 1 }]}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Global Announcement</Text>
                    <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>Post a message to the community notice board.</Text>

                    <TextInput
                        style={[styles.announcementInput, { color: theme.text, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC', borderColor: theme.border }]}
                        placeholder="Type your message here..."
                        placeholderTextColor={theme.textMuted}
                        value={announcement}
                        onChangeText={setAnnouncement}
                        multiline
                    />

                    <TouchableOpacity
                        style={[styles.broadcastButton, { backgroundColor: PLAN_COLORS.All.hex }, (!announcement.trim() || isBroadcasting) && { opacity: 0.5 }]}
                        onPress={handleBroadcast}
                        disabled={!announcement.trim() || isBroadcasting}
                    >
                        {isBroadcasting ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <>
                                <MaterialCommunityIcons name="bullhorn-outline" size={20} color="#FFF" />
                                <Text style={styles.broadcastButtonText}>Post Announcement</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={styles.actionsGrid}>
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F1F5F9' }]}
                        onPress={() => navigation.navigate('AdminPayments')}
                    >
                        <MaterialCommunityIcons name="credit-card-check" size={24} color={PLAN_COLORS.All.hex} />
                        <Text style={[styles.actionButtonText, { color: theme.text }]}>Manage Payments</Text>
                        <View style={[styles.badge, { backgroundColor: PLAN_COLORS.Family.hex }]}>
                            <Text style={styles.badgeText}>{stats.pendingPayments}</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F1F5F9' }]}
                        onPress={() => navigation.navigate('AdminMembers')}
                    >
                        <MaterialCommunityIcons name="account-search" size={24} color={PLAN_COLORS.Basic.hex} />
                        <Text style={[styles.actionButtonText, { color: theme.text }]}>Member Directory</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F1F5F9' }]}
                        onPress={() => navigation.navigate('GymCalendar')}
                    >
                        <MaterialCommunityIcons name="calendar-plus" size={24} color={PLAN_COLORS.Couple.hex} />
                        <Text style={[styles.actionButtonText, { color: theme.text }]}>Manage Classes</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F1F5F9' }]}
                        onPress={() => navigation.navigate('Attendance')}
                    >
                        <MaterialCommunityIcons name="clipboard-pulse" size={24} color="#10B981" />
                        <Text style={[styles.actionButtonText, { color: theme.text }]}>Live Attendance</Text>
                    </TouchableOpacity>
                </View>
            </View>
            <View style={{ height: 100 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 30 },
    headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    backButton: { marginRight: 15 },
    title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
    subtitle: { fontSize: 13, fontWeight: '500' },
    content: { padding: 20 },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 25 },
    statCard: { width: '48%', padding: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
    statIconContainer: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    statLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    statValue: { fontSize: 18, fontWeight: '800', marginTop: 2 },
    section: { padding: 20, borderRadius: 24, marginBottom: 25 },
    sectionTitle: { fontSize: 18, fontWeight: '700' },
    sectionSubtitle: { fontSize: 13, marginTop: 4, marginBottom: 15 },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
    chartContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', height: 120, marginTop: 10, paddingHorizontal: 10 },
    chartColumn: { alignItems: 'center', gap: 8 },
    chartBar: { width: 12, borderRadius: 6 },
    chartDay: { fontSize: 10, fontWeight: '600' },
    chartTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: 'rgba(150,150,150,0.1)' },
    chartTotalLabel: { fontSize: 13, fontWeight: '500' },
    chartTotalValue: { fontSize: 18, fontWeight: '800' },
    announcementInput: {
        borderRadius: 15,
        padding: 15,
        height: 100,
        textAlignVertical: 'top',
        borderWidth: 1,
        fontSize: 15,
        ...Platform.select({
            web: {
                outlineStyle: 'none',
            } as any
        })
    },
    broadcastButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 15, marginTop: 15 },
    broadcastButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
    actionsGrid: { gap: 12 },
    actionButton: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 20, gap: 15 },
    actionButtonText: { flex: 1, fontSize: 16, fontWeight: '600' },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
    badgeText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
    liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(34, 197, 94, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, marginTop: 4, alignSelf: 'flex-start' },
    pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
    liveBadgeText: { fontSize: 9, fontWeight: '900', color: '#10B981', letterSpacing: 0.5 },
    mixGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginTop: 10 },
    mixItem: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '45%' },
    mixIndicator: { width: 10, height: 10, borderRadius: 5 },
    mixLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    mixValue: { fontSize: 16, fontWeight: '900' }
});
