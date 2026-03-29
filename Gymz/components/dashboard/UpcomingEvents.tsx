import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { supabase } from '../../services/supabase';
import { DataMapper } from '../../utils/dataMapper';
import { EventPriceBadge } from '../EventPriceBadge';
import { designSystem } from '../../theme/designSystem';

interface Event {
    id: string;
    title: string;
    description?: string;
    location?: string;
    eventDate: string;
    endDate?: string;
    capacity?: number;
    rsvpCount?: number;
    userRsvpStatus?: string | null;
    imageUrl?: string;
    isFree?: boolean;
    price?: number | null;
}

interface UpcomingEventsProps {
    navigation: any;
}

const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const getDaysUntil = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `In ${days} days`;
};

export function UpcomingEvents({ navigation }: UpcomingEventsProps) {
    const { user } = useAuth();
    const { theme } = useTheme();
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchEvents = useCallback(async () => {
        if (!user?.gymId) {
            setLoading(false);
            return;
        }
        try {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const { data: eventsData, error } = await (supabase as any)
                .from('events')
                .select('*')
                .eq('gym_id', user.gymId)
                .eq('is_active', true)
                .gte('event_date', todayStart.toISOString())
                .order('event_date', { ascending: true })
                .limit(5);

            if (error) {
                console.warn('[UpcomingEvents] fetch error:', error);
                setEvents([]);
                return;
            }

            const mapped = DataMapper.fromDb<Event[]>(eventsData) || [];

            if (mapped.length > 0 && user?.id) {
                const eventIds = mapped.map((e) => e.id);
                const { data: rsvpData } = await (supabase as any)
                    .from('event_rsvps')
                    .select('event_id, status')
                    .eq('user_id', user.id)
                    .in('event_id', eventIds);

                const rsvpMap: Record<string, string> = {};
                (DataMapper.fromDb<any[]>(rsvpData) || []).forEach((r: any) => {
                    rsvpMap[r.eventId] = r.status;
                });

                setEvents(
                    mapped.map((e) => ({
                        ...e,
                        userRsvpStatus: rsvpMap[e.id] || null,
                    }))
                );
            } else {
                setEvents(mapped);
            }
        } catch (err) {
            console.error('[UpcomingEvents] fetch error:', err);
            setEvents([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user?.gymId, user?.id]);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchEvents();
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.loadingContainer]}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading events...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Community Events</Text>
                <TouchableOpacity onPress={() => navigation.navigate('EventCalendar')}>
                    <Text style={[styles.seeAllText, { color: theme.primary }]}>See All</Text>
                </TouchableOpacity>
            </View>

            {events.length > 0 ? (
                <View style={styles.eventsList}>
                    {events.map((event) => (
                        <TouchableOpacity
                            key={event.id}
                            style={[styles.eventCard, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}
                            onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
                            activeOpacity={0.8}
                        >
                            <View style={[styles.dateBox, { borderRightColor: theme.border }]}>
                                <Text style={[styles.dateDay, { color: theme.text }]}>
                                    {new Date(event.eventDate).getDate()}
                                </Text>
                                <Text style={[styles.dateMonth, { color: theme.textSecondary }]}>
                                    {new Date(event.eventDate).toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}
                                </Text>
                            </View>
                            <View style={styles.eventInfo}>
                                <View style={styles.eventTitleRow}>
                                    <Text style={[styles.eventTitle, { color: theme.text }]} numberOfLines={1}>
                                        {event.title}
                                    </Text>
                                    <EventPriceBadge isFree={event.isFree !== false} price={event.price} variant="compact" />
                                </View>
                                <View style={styles.eventMeta}>
                                    <MaterialCommunityIcons name="clock-outline" size={12} color={theme.textSecondary} />
                                    <Text style={[styles.eventMetaText, { color: theme.textSecondary }]}>
                                        {formatTime(event.eventDate)}
                                        {event.location ? ` · ${event.location}` : ''}
                                    </Text>
                                </View>
                                <View style={styles.eventFooter}>
                                    <Text style={[styles.countdownText, { color: theme.primary }]}>
                                        {getDaysUntil(event.eventDate)}
                                    </Text>
                                    {event.capacity != null && (
                                        <Text style={[styles.capacityText, { color: theme.textMuted }]}>
                                            {event.rsvpCount ?? 0}/{event.capacity} spots
                                        </Text>
                                    )}
                                </View>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textMuted} />
                        </TouchableOpacity>
                    ))}
                </View>
            ) : (
                <View style={[styles.emptyState, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}>
                    <MaterialCommunityIcons name="calendar-blank-outline" size={40} color={theme.textMuted} />
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No upcoming events</Text>
                    <Text style={[styles.emptySubtext, { color: theme.textMuted }]}>Check back soon</Text>
                </View>
            )}

            <View style={styles.quickActions}>
                <TouchableOpacity
                    style={styles.quickAction}
                    onPress={() => navigation.navigate('EventCalendar')}
                >
                    <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(42,75,42,0.15)' }]}>
                        <MaterialCommunityIcons name="calendar-month" size={22} color="#4CAF50" />
                    </View>
                    <Text style={[styles.quickActionText, { color: theme.textSecondary }]}>All Events</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.quickAction}
                    onPress={() => navigation.navigate('EventHistory')}
                >
                    <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(96,165,250,0.15)' }]}>
                        <MaterialCommunityIcons name="history" size={22} color="#60a5fa" />
                    </View>
                    <Text style={[styles.quickActionText, { color: theme.textSecondary }]}>My History</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.quickAction}
                    onPress={() => navigation.navigate('EventTribes')}
                >
                    <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(168,85,247,0.15)' }]}>
                        <MaterialCommunityIcons name="forum-outline" size={22} color="#a855f7" />
                    </View>
                    <Text style={[styles.quickActionText, { color: theme.textSecondary }]}>Community</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.quickAction}
                    onPress={() => navigation.navigate('EventQRCheckIn')}
                >
                    <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(241,201,59,0.15)' }]}>
                        <MaterialCommunityIcons name="qrcode-scan" size={22} color="#F1C93B" />
                    </View>
                    <Text style={[styles.quickActionText, { color: theme.textSecondary }]}>Check In</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: designSystem.spacing.xl,
    },
    loadingContainer: {
        paddingVertical: 32,
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
        fontWeight: '500',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: designSystem.spacing.lg,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    seeAllText: {
        fontSize: 14,
        fontWeight: '600',
    },
    eventsList: {
        gap: 12,
    },
    eventCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 18,
        borderRadius: 20,
        borderWidth: 1,
    },
    dateBox: {
        width: 60,
        alignItems: 'center',
        borderRightWidth: 1,
        paddingRight: 16,
    },
    dateDay: {
        fontSize: 22,
        fontWeight: '800',
    },
    dateMonth: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    eventInfo: {
        flex: 1,
        paddingLeft: 16,
    },
    eventTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 6,
    },
    eventTitle: {
        fontSize: 16,
        fontWeight: '700',
        flex: 1,
    },
    eventMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    eventMetaText: {
        fontSize: 13,
        fontWeight: '500',
        flex: 1,
    },
    eventFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    countdownText: {
        fontSize: 12,
        fontWeight: '700',
    },
    capacityText: {
        fontSize: 12,
        fontWeight: '500',
    },
    emptyState: {
        borderRadius: 20,
        padding: 32,
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
    },
    emptyText: {
        fontSize: 15,
        fontWeight: '600',
    },
    emptySubtext: {
        fontSize: 13,
        fontWeight: '500',
    },
    quickActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20,
        gap: 6,
    },
    quickAction: {
        flex: 1,
        alignItems: 'center',
        gap: 8,
    },
    quickActionIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quickActionText: {
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center',
    },
});
