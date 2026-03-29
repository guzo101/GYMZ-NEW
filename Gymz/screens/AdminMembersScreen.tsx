import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
    Alert,
    RefreshControl,
    Platform
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../services/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { designSystem } from '../theme/designSystem';
import { ScreenHeader } from '../components/ScreenHeader';
import { DynamicBackground } from '../components/dashboard/DynamicBackground';
import { hapticService } from '../services/hapticService';
import { DataMapper } from '../utils/dataMapper';

export default function AdminMembersScreen({ navigation }: any) {
    const { user } = useAuth();
    const { theme, isDark } = useTheme();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [members, setMembers] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');

    useEffect(() => {
        if (user && user.role?.toLowerCase() !== 'admin') {
            navigation.goBack();
            return;
        }
        fetchMembers();
    }, [statusFilter, user]);

    const fetchMembers = async () => {
        try {
            setLoading(true);
            let query = supabase
                .from('users')
                .select('*')
                .eq('role', 'member')
                .order('first_name', { ascending: true });

            if (statusFilter !== 'All') {
                query = query.eq('membership_status', statusFilter);
            }

            const { data, error } = await query;
            if (error) throw error;
            setMembers(DataMapper.fromDb<any[]>(data || []));
        } catch (error) {
            console.error('Error fetching members:', error);
            Alert.alert('Error', 'Failed to load members.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleUpdateStatus = async (member: any, newStatus: string) => {
        hapticService.medium();
        try {
            const { error } = await (supabase as any)
                .from('users')
                .update({ membership_status: newStatus })
                .eq('id', member.id);

            if (error) throw error;
            hapticService.success();
            Alert.alert('Success', `Status for ${member.firstName} updated to ${newStatus}.`);
            fetchMembers();
        } catch (error: any) {
            Alert.alert('Error', 'Failed to update status.');
        }
    };

    const filteredMembers = members.filter(m =>
        (m.firstName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.lastName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchMembers();
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <DynamicBackground rotationType="fixed" fixedIndex={5} />
            <ScreenHeader title="Member Directory" />

            <View style={styles.controls}>
                <View style={[styles.searchBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9', borderColor: theme.border }]}>
                    <MaterialCommunityIcons name="magnify" size={20} color={theme.textSecondary} />
                    <TextInput
                        style={[styles.searchInput, { color: theme.text }]}
                        placeholder="Search users..."
                        placeholderTextColor={theme.textMuted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                    {['All', 'Active', 'Pending', 'Expired'].map(status => (
                        <TouchableOpacity
                            key={status}
                            style={[
                                styles.filterChip,
                                { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFF', borderColor: theme.border },
                                statusFilter === status && { backgroundColor: theme.primary, borderColor: theme.primary }
                            ]}
                            onPress={() => {
                                hapticService.selection();
                                setStatusFilter(status);
                            }}
                        >
                            <Text style={[styles.filterText, { color: theme.text }, statusFilter === status && { color: '#FFF' }]}>{status}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <ScrollView
                style={styles.memberList}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
            >
                {loading && !refreshing ? (
                    <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
                ) : filteredMembers.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialCommunityIcons name="account-off" size={64} color={theme.textMuted} />
                        <Text style={[styles.emptyText, { color: theme.textMuted }]}>No members found</Text>
                    </View>
                ) : (
                    filteredMembers.map((member) => (
                        <TouchableOpacity
                            key={member.id}
                            style={[styles.memberCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFF', borderColor: theme.border }]}
                            onPress={() => {
                                Alert.alert(
                                    `${member.firstName} ${member.lastName}`,
                                    `Actions for ${member.email}`,
                                    [
                                        { text: 'Cancel', style: 'cancel' },
                                        { text: 'Set Active', onPress: () => handleUpdateStatus(member, 'Active') },
                                        { text: 'Set Pending', onPress: () => handleUpdateStatus(member, 'Pending') },
                                        { text: 'Set Expired', onPress: () => handleUpdateStatus(member, 'Expired') },
                                    ]
                                );
                            }}
                        >
                            <View style={[styles.avatar, { backgroundColor: theme.primary + '20' }]}>
                                <Text style={[styles.avatarText, { color: theme.primary }]}>
                                    {(member.firstName?.[0] || member.email?.[0] || 'U').toUpperCase()}
                                </Text>
                            </View>
                            <View style={styles.memberInfo}>
                                <Text style={[styles.memberName, { color: theme.text }]}>
                                    {member.firstName} {member.lastName}
                                </Text>
                                <Text style={[styles.memberEmail, { color: theme.textSecondary }]}>{member.email}</Text>
                                <View style={styles.metaRow}>
                                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(member.membershipStatus) + '20' }]}>
                                        <Text style={[styles.statusText, { color: getStatusColor(member.membershipStatus) }]}>
                                            {member.membershipStatus || 'Unknown'}
                                        </Text>
                                    </View>
                                    {member.renewal_due_date && (
                                        <Text style={[styles.expiryText, { color: theme.textMuted }]}>
                                            Exp: {format(new Date(member.renewal_due_date), 'MMM d')}
                                        </Text>
                                    )}
                                </View>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={24} color={theme.textMuted} />
                        </TouchableOpacity>
                    ))
                )}
                <View style={{ height: 100 }} />
            </ScrollView>
        </View>
    );
}

const getStatusColor = (status: string) => {
    switch ((status || '').toLowerCase()) {
        case 'active': return '#10B981';
        case 'pending': return '#F59E0B';
        case 'expired': return '#EF4444';
        default: return '#94A3B8';
    }
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    controls: { padding: 20, gap: 12 },
    searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 50, borderRadius: 15, borderWidth: 1 },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 16,
        ...Platform.select({
            web: {
                outlineStyle: 'none',
            } as any
        })
    },
    filterScroll: { flexDirection: 'row' },
    filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, marginRight: 8 },
    filterText: { fontSize: 13, fontWeight: '600' },
    memberList: { flex: 1, paddingHorizontal: 20 },
    memberCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, borderWidth: 1, marginBottom: 12 },
    avatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    avatarText: { fontSize: 20, fontWeight: 'bold' },
    memberInfo: { flex: 1 },
    memberName: { fontSize: 16, fontWeight: '700' },
    memberEmail: { fontSize: 12, marginBottom: 6 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    statusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
    expiryText: { fontSize: 11 },
    emptyState: { alignItems: 'center', marginTop: 100 },
    emptyText: { marginTop: 16 }
});
