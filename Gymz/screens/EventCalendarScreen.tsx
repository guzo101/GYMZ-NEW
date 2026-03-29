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
import { EventPriceBadge } from '../components/EventPriceBadge';

interface Event {
    id: string;
    title: string;
    description?: string;
    location?: string;
    eventDate: string;
    endDate?: string;
    capacity?: number;
    isRecurring?: boolean;
    visibility?: string;
    userRsvpStatus?: string | null;
    rsvpCount?: number;
    isFree?: boolean;
    price?: number | null;
}

interface Props {
    navigation: any;
}

const FILTERS = ['All', 'This Week', 'This Month', 'Going'];

export default function EventCalendarScreen({ navigation }: Props) {
    const { user } = useAuth();
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeFilter, setActiveFilter] = useState('All');

    const fetchEvents = useCallback(async () => {
        if (!user?.gymId) return;
        try {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            let query = (supabase as any)
                .from('events')
                .select('*')
                .eq('gym_id', user.gymId)
                .eq('is_active', true)
                .gte('event_date', todayStart.toISOString())
                .order('event_date', { ascending: true });

            // Apply date filter
            if (activeFilter === 'This Week') {
                const weekEnd = new Date();
                weekEnd.setDate(weekEnd.getDate() + 7);
                query = query.lte('event_date', weekEnd.toISOString());
            } else if (activeFilter === 'This Month') {
                const monthEnd = new Date();
                monthEnd.setMonth(monthEnd.getMonth() + 1);
                query = query.lte('event_date', monthEnd.toISOString());
            }

            const { data: eventsData, error } = await query;
            if (error) throw error;

            const transformedEvents = DataMapper.fromDb<Event[]>(eventsData || []);

            // Fetch user RSVPs for these events
            const eventIds = transformedEvents.map((e: Event) => e.id);
            let rsvpMap: Record<string, string> = {};

            if (eventIds.length > 0) {
                const { data: rsvpData } = await (supabase as any)
                    .from('event_rsvps')
                    .select('event_id, status')
                    .eq('user_id', user.id)
                    .in('event_id', eventIds);

                const transformedRsvps = DataMapper.fromDb<any[]>(rsvpData || []);
                transformedRsvps.forEach((r: any) => {
                    rsvpMap[r.eventId] = r.status;
                });
            }

            let enriched = transformedEvents.map((e: Event) => ({
                ...e,
                userRsvpStatus: rsvpMap[e.id] || null,
            }));

            // Filter by Going (user has signed up)
            if (activeFilter === 'Going') {
                enriched = enriched.filter((e: Event) =>
                    e.userRsvpStatus === 'confirmed' || e.userRsvpStatus === 'waitlisted'
                );
            }

            setEvents(enriched);
        } catch (err) {
            console.error('[EventCalendar] fetch error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user?.gymId, user?.id, activeFilter]);

    useEffect(() => { fetchEvents(); }, [fetchEvents]);

    const onRefresh = () => { setRefreshing(true); fetchEvents(); };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric',
        });
    };

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit',
        });
    };

    const getCapacityColor = (rsvpCount: number, capacity: number) => {
        const pct = rsvpCount / capacity;
        if (pct >= 1) return '#ef4444';
        if (pct >= 0.8) return '#F1C93B';
        return '#4CAF50';
    };

    const renderEvent = ({ item }: { item: Event }) => {
        const isRsvpd = item.userRsvpStatus === 'confirmed';
        const isWaitlisted = item.userRsvpStatus === 'waitlisted';
        const isFull = item.capacity && (item.rsvpCount || 0) >= item.capacity;

        return (
            <TouchableOpacity
                style={styles.eventCard}
                onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
                activeOpacity={0.8}
            >
                {/* Date column */}
                <View style={styles.dateColumn}>
                    <Text style={styles.dateDay}>
                        {new Date(item.eventDate).toLocaleDateString('en-US', { day: 'numeric' })}
                    </Text>
                    <Text style={styles.dateMonth}>
                        {new Date(item.eventDate).toLocaleDateString('en-US', { month: 'short' })}
                    </Text>
                    <Text style={styles.dateWeekday}>
                        {new Date(item.eventDate).toLocaleDateString('en-US', { weekday: 'short' })}
                    </Text>
                </View>

                {/* Divider */}
                <View style={[styles.divider, isRsvpd && styles.dividerRsvpd]} />

                {/* Content */}
                <View style={styles.eventContent}>
                    <View style={styles.eventTitleRow}>
                        <Text style={styles.eventTitle} numberOfLines={1}>{item.title}</Text>
                        <EventPriceBadge isFree={item.isFree !== false} price={item.price} variant="compact" />
                        {item.isRecurring && (
                            <MaterialCommunityIcons name="repeat" size={14} color="rgba(255,255,255,0.3)" />
                        )}
                    </View>

                    <View style={styles.eventMeta}>
                        <MaterialCommunityIcons name="clock-outline" size={12} color="rgba(255,255,255,0.4)" />
                        <Text style={styles.eventMetaText}>{formatTime(item.eventDate)}</Text>
                        {item.location && (
                            <>
                                <Text style={styles.dot}>·</Text>
                                <MaterialCommunityIcons name="map-marker-outline" size={12} color="rgba(255,255,255,0.4)" />
                                <Text style={styles.eventMetaText} numberOfLines={1}>{item.location}</Text>
                            </>
                        )}
                    </View>

                    {item.capacity && (
                        <View style={styles.capacityRow}>
                            <View style={styles.capacityBar}>
                                <View
                                    style={[
                                        styles.capacityFill,
                                        {
                                            width: `${Math.min(100, ((item.rsvpCount || 0) / item.capacity) * 100)}%`,
                                            backgroundColor: getCapacityColor(item.rsvpCount || 0, item.capacity),
                                        },
                                    ]}
                                />
                            </View>
                            <Text style={styles.capacityText}>
                                {item.rsvpCount || 0}/{item.capacity}
                            </Text>
                        </View>
                    )}

                    {/* Status badges */}
                    <View style={styles.badgeRow}>
                        {isRsvpd && (
                            <View style={styles.rsvpdBadge}>
                                <MaterialCommunityIcons name="check-circle" size={12} color="#4CAF50" />
                                <Text style={styles.rsvpdBadgeText}>Booked</Text>
                            </View>
                        )}
                        {isWaitlisted && (
                            <View style={styles.waitlistBadge}>
                                <MaterialCommunityIcons name="clock-outline" size={12} color="#F1C93B" />
                                <Text style={styles.waitlistBadgeText}>Waitlisted</Text>
                            </View>
                        )}
                        {isFull && !isRsvpd && !isWaitlisted && (
                            <View style={styles.fullBadge}>
                                <Text style={styles.fullBadgeText}>Full — Join Waitlist</Text>
                            </View>
                        )}
                    </View>
                </View>

                <MaterialCommunityIcons name="chevron-right" size={18} color="rgba(255,255,255,0.25)" />
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#0A120A', '#1B241B', '#080F08']} style={StyleSheet.absoluteFill} pointerEvents="none" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Events Calendar</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Filters */}
            <View style={styles.filtersContainer}>
                {FILTERS.map((filter) => (
                    <TouchableOpacity
                        key={filter}
                        style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
                        onPress={() => setActiveFilter(filter)}
                    >
                        <Text style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}>
                            {filter}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Events List */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#2A4B2A" />
                </View>
            ) : (
                <FlatList
                    data={events}
                    keyExtractor={(item) => item.id}
                    renderItem={renderEvent}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2A4B2A" />}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="calendar-blank-outline" size={56} color="rgba(255,255,255,0.1)" />
                            <Text style={styles.emptyTitle}>No events yet under this gym</Text>
                            <Text style={styles.emptySubtitle}>
                                {activeFilter !== 'All' ? 'Try a different filter' : 'Check back soon!'}
                            </Text>
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
        paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingBottom: 16,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
    filtersContainer: {
        flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 16,
    },
    filterChip: {
        paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    filterChipActive: { backgroundColor: 'rgba(42,75,42,0.5)', borderColor: '#2A4B2A' },
    filterText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
    filterTextActive: { color: '#4CAF50' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 10 },
    eventCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 18, padding: 16, gap: 14,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    },
    dateColumn: { alignItems: 'center', width: 40 },
    dateDay: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
    dateMonth: { fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' },
    dateWeekday: { fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 },
    divider: { width: 2, height: '100%', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 1 },
    dividerRsvpd: { backgroundColor: '#2A4B2A' },
    eventContent: { flex: 1, gap: 5 },
    eventTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    eventTitle: { fontSize: 14, fontWeight: '700', color: '#fff', flex: 1 },
    eventMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    eventMetaText: { fontSize: 11, color: 'rgba(255,255,255,0.4)', maxWidth: 100 },
    dot: { color: 'rgba(255,255,255,0.2)' },
    capacityRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    capacityBar: {
        flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden',
    },
    capacityFill: { height: '100%', borderRadius: 2 },
    capacityText: { fontSize: 10, color: 'rgba(255,255,255,0.35)', minWidth: 36 },
    badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    rsvpdBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: 'rgba(42,75,42,0.4)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    },
    rsvpdBadgeText: { fontSize: 10, color: '#4CAF50', fontWeight: '700' },
    waitlistBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: 'rgba(241,201,59,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    },
    waitlistBadgeText: { fontSize: 10, color: '#F1C93B', fontWeight: '700' },
    fullBadge: {
        backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    },
    fullBadgeText: { fontSize: 10, color: '#ef4444', fontWeight: '700' },
    emptyState: { alignItems: 'center', paddingTop: 80, gap: 10 },
    emptyTitle: { fontSize: 16, color: 'rgba(255,255,255,0.3)', fontWeight: '600' },
    emptySubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.2)' },
});
