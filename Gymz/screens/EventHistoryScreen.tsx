import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { DataMapper } from '../utils/dataMapper';

interface EventHistoryItem {
    id: string;
    status: string;
    checkInTime: string;
    events: {
        id: string;
        title: string;
        eventDate: string;
        location: string;
    };
}

export default function EventHistoryScreen({ navigation }: any) {
    const { user } = useAuth();
    const [history, setHistory] = useState<EventHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchHistory = useCallback(async () => {
        if (!user?.id) return;
        try {
            const { data, error } = await (supabase as any)
                .from('event_rsvps')
                .select('*, events(id, title, event_date, location)')
                .eq('user_id', user.id)
                .eq('status', 'attended')
                .order('check_in_time', { ascending: false });

            if (error) throw error;
            setHistory(DataMapper.fromDb<EventHistoryItem[]>(data || []));
        } catch (err) {
            console.error('[EventHistory] Fetch error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchHistory();
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
    };

    const renderItem = ({ item }: { item: EventHistoryItem }) => (
        <TouchableOpacity
            style={styles.historyCard}
            onPress={() => navigation.navigate('EventDetail', { eventId: item.events.id })}
        >
            <View style={styles.iconBox}>
                <MaterialCommunityIcons name="calendar-check" size={24} color="#4CAF50" />
            </View>
            <View style={styles.cardContent}>
                <Text style={styles.eventTitle} numberOfLines={1}>{item.events.title}</Text>
                <Text style={styles.eventDate}>{formatDate(item.events.eventDate)}</Text>
                <View style={styles.attendedBadge}>
                    <Text style={styles.attendedText}>Attended on {formatDate(item.checkInTime)}</Text>
                </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="rgba(255,255,255,0.2)" />
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#0A120A', '#1B241B', '#080F08']} style={StyleSheet.absoluteFill} pointerEvents="none" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Attended Events</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4CAF50" />
                </View>
            ) : (
                <FlatList
                    data={history}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4CAF50" />}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="history" size={64} color="rgba(255,255,255,0.1)" />
                            <Text style={styles.emptyTitle}>No past events found</Text>
                            <Text style={styles.emptySubtitle}>Start attending events to build your history!</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050B05' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 20,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { padding: 20, paddingBottom: 40, gap: 12 },
    historyCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 16, padding: 16, gap: 16,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    },
    iconBox: {
        width: 48, height: 48, borderRadius: 12,
        backgroundColor: 'rgba(42,75,42,0.2)',
        justifyContent: 'center', alignItems: 'center',
    },
    cardContent: { flex: 1 },
    eventTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 2 },
    eventDate: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 6 },
    attendedBadge: {
        backgroundColor: 'rgba(42,75,42,0.3)',
        alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
    },
    attendedText: { color: '#4CAF50', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
    emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 100, gap: 12 },
    emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
    emptySubtitle: { color: 'rgba(255,255,255,0.4)', textAlign: 'center', paddingHorizontal: 40 },
});
