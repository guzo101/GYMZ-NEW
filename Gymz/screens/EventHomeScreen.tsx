import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Platform,
    ActivityIndicator,
    Image,
    Dimensions,
    Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { DataMapper } from '../utils/dataMapper';
import { CalibrationBanner } from '../components/CalibrationBanner';
import { EventPriceBadge } from '../components/EventPriceBadge';
import { NotificationBell } from '../components/notifications/NotificationBell';

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

interface BannerAd {
    id: string;
    imageUrl: string;
    linkUrl?: string;
    audienceType?: string;
}

interface Props {
    navigation: any;
}

export default function EventHomeScreen({ navigation }: Props) {
    const { user, currentGym, isGymMember, isEventMember, isCalibrated } = useAuth();
    const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
    const [myRsvps, setMyRsvps] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({ eventsAttended: 0, rsvpCount: 0 });
    const [banners, setBanners] = useState<BannerAd[]>([]);
    const [bannerIndex, setBannerIndex] = useState(0);

    const { width: screenWidth } = Dimensions.get('window');

    // ══════════════════════════════════════════════════════════════════════════════
    // SECURITY GATE: Defense-in-depth — catch bypass attempts
    // ══════════════════════════════════════════════════════════════════════════════
    React.useEffect(() => {
        if (!user) return;
        const hasGymMapping = Boolean(user.gymId && user.accessMode);
        if (!hasGymMapping) {
            console.warn('[EventHomeScreen] SECURITY: User missing gym mapping, redirecting');
            navigation.reset({ index: 0, routes: [{ name: 'GymSelection' }] });
            return;
        }
        if (!user.uniqueId) {
            console.warn('[EventHomeScreen] SECURITY: User missing member ID, redirecting');
            navigation.reset({ index: 0, routes: [{ name: 'AccessGate' }] });
            return;
        }
        if (!isCalibrated) {
            console.warn('[EventHomeScreen] SECURITY: User not calibrated, redirecting');
            navigation.reset({ index: 0, routes: [{ name: 'HealthMetrics', params: { isHardGate: true } }] });
            return;
        }
    }, [user, isCalibrated, navigation]);

    const fetchData = useCallback(async () => {
        if (!user?.gymId) return;
        try {
            // Fetch upcoming events for this gym (start of today so today's events show)
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const { data: eventsData, error: eventsErr } = await (supabase as any)
                .from('events')
                .select('*')
                .eq('gym_id', user.gymId)
                .eq('is_active', true)
                .gte('event_date', todayStart.toISOString())
                .order('event_date', { ascending: true })
                .limit(5);
            if (eventsErr) console.warn('[EventHomeScreen] events fetch error:', eventsErr);

            // Fetch user's RSVPs
            const { data: rsvpData } = await (supabase as any)
                .from('event_rsvps')
                .select('*, events(*)')
                .eq('user_id', user.id)
                .in('status', ['confirmed', 'waitlisted'])
                .order('created_at', { ascending: false })
                .limit(3);

            // Fetch stats
            const { count: attendedCount } = await (supabase as any)
                .from('event_rsvps')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('status', 'attended');

            const { count: rsvpCount } = await (supabase as any)
                .from('event_rsvps')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .in('status', ['confirmed', 'waitlisted']);

            const mappedEvents = DataMapper.fromDb<Event[]>(eventsData) || [];
            const rsvpMapped = DataMapper.fromDb<any[]>(rsvpData) || [];
            
            // Map status to upcoming events
            const enrichedEvents = mappedEvents.map(e => {
                const rsvp = rsvpMapped.find((r: any) => r.eventId === e.id);
                return { ...e, userRsvpStatus: rsvp ? rsvp.status : null };
            });

            setUpcomingEvents(enrichedEvents);
            setMyRsvps(rsvpMapped.map((r: any) => ({ ...r.events, userRsvpStatus: r.status })));
            setStats({ eventsAttended: attendedCount || 0, rsvpCount: rsvpCount || 0 });

            // Fetch active banners
            const { data: bannerData } = await (supabase as any)
                .from('banner_ads')
                .select('id, image_url, link_url, audience_type')
                .eq('gym_id', user.gymId)
                .eq('is_active', true)
                .in('placement_type', ['global', 'event_home']);

            if (bannerData && bannerData.length > 0) {
                const bannerMapped = DataMapper.fromDb<BannerAd[]>(bannerData);
                // Client-side filtering for audience
                const filtered = bannerMapped.filter((b) => {
                    if (b.audienceType === 'all') return true;
                    if (b.audienceType === 'gym_members' && isGymMember) return true;
                    if (b.audienceType === 'event_members' && isEventMember) return true;
                    return false;
                });

                setBanners(filtered);
                // Proactively track impressions for all visible banners in this session
                filtered.forEach(async (b: any) => {
                    await (supabase as any).rpc('increment_banner_impression', { banner_id: b.id });
                });
            }
        } catch (err) {
            console.error('[EventHome] fetch error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user?.gymId, user?.id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const onRefresh = () => { setRefreshing(true); fetchData(); };

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

    const handleBannerPress = async (banner: BannerAd) => {
        if (!banner.linkUrl) return;
        try {
            await (supabase as any).rpc('increment_banner_click', { banner_id: banner.id });
            Linking.openURL(banner.linkUrl);
        } catch (err) {
            console.error('Failed to open banner link:', err);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <LinearGradient colors={['#0A120A', '#1B241B']} style={StyleSheet.absoluteFill} pointerEvents="none" />
                <ActivityIndicator size="large" color="#2A4B2A" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#0A120A', '#1B241B', '#080F08']} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <View style={styles.glow1} pointerEvents="none" />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2A4B2A" />}
            >
                {!user?.isCalibrated && (
                    <CalibrationBanner onPress={() => navigation.navigate('HealthMetrics')} />
                )}
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerMain}>
                        {currentGym && (
                            <View style={styles.gymBadge}>
                                <MaterialCommunityIcons name="dumbbell" size={11} color="#F1C93B" />
                                <Text style={styles.gymBadgeText}>{currentGym.name}</Text>
                                <View style={styles.eventAccessBadge}>
                                    <Text style={styles.eventAccessText}>EVENT ACCESS</Text>
                                </View>
                            </View>
                        )}
                    </View>

                    <View style={styles.headerRight}>
                        <NotificationBell />
                        <TouchableOpacity
                            style={styles.avatarButton}
                            onPress={() => navigation.navigate('Profile')}
                            activeOpacity={0.8}
                        >
                            {user?.avatarUrl ? (
                                <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
                            ) : (
                                <LinearGradient
                                    colors={['#4CAF50', '#2E7D32']}
                                    style={styles.avatarPlaceholder}
                                >
                                    <Text style={styles.avatarInitial}>
                                        {(user?.name || 'A').charAt(0).toUpperCase()}
                                    </Text>
                                </LinearGradient>
                            )}
                            <View style={styles.avatarGlow} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Sponsor Banner Carousel */}
                {banners.length > 0 && (
                    <View style={styles.bannerSection}>
                        <ScrollView
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            onScroll={(e) => {
                                const offset = e.nativeEvent.contentOffset.x;
                                setBannerIndex(Math.round(offset / (screenWidth - 40)));
                            }}
                            scrollEventThrottle={16}
                        >
                            {banners.map((banner) => (
                                <TouchableOpacity
                                    key={banner.id}
                                    style={[styles.bannerCard, { width: screenWidth - 40 }]}
                                    activeOpacity={0.9}
                                    onPress={() => handleBannerPress(banner)}
                                >
                                    <Image
                                        source={{ uri: banner.imageUrl }}
                                        style={styles.bannerImage}
                                        resizeMode="cover"
                                    />
                                    <View style={styles.bannerOverlay}>
                                        <Text style={styles.bannerTag}>PARTNER</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        {banners.length > 1 && (
                            <View style={styles.paginationDots}>
                                {banners.map((_, i) => (
                                    <View
                                        key={i}
                                        style={[
                                            styles.dot,
                                            bannerIndex === i && styles.activeDot
                                        ]}
                                    />
                                ))}
                            </View>
                        )}
                    </View>
                )}

                {/* Stats Row */}
                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <MaterialCommunityIcons name="calendar-check" size={22} color="#4CAF50" />
                        <Text style={styles.statValue}>{stats.eventsAttended}</Text>
                        <Text style={styles.statLabel}>Attended</Text>
                    </View>
                    <View style={styles.statCard}>
                        <MaterialCommunityIcons name="calendar-clock" size={22} color="#60a5fa" />
                        <Text style={styles.statValue}>{stats.rsvpCount}</Text>
                        <Text style={styles.statLabel}>Upcoming</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.statCard, styles.statCardUpgrade]}
                        onPress={() => navigation.navigate('SubscriptionPlans')}
                    >
                        <MaterialCommunityIcons name="arrow-up-circle" size={22} color="#F1C93B" />
                        <Text style={[styles.statLabel, { color: '#F1C93B', marginTop: 4 }]}>Upgrade</Text>
                        <Text style={[styles.statLabel, { color: 'rgba(241,201,59,0.6)', fontSize: 10 }]}>to Gym</Text>
                    </TouchableOpacity>
                </View>

                {/* My RSVPs */}
                {myRsvps.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>My Upcoming Events</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('EventHistory')}>
                                <Text style={styles.sectionLink}>View All</Text>
                            </TouchableOpacity>
                        </View>
                        {myRsvps.map((event) => (
                            <TouchableOpacity
                                key={event.id}
                                style={styles.rsvpCard}
                                onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={['rgba(42,75,42,0.3)', 'rgba(42,75,42,0.1)']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.rsvpCardGradient}
                                >
                                    <View style={styles.rsvpDateBox}>
                                        <Text style={styles.rsvpDay}>
                                            {new Date(event.eventDate).toLocaleDateString('en-US', { day: 'numeric' })}
                                        </Text>
                                        <Text style={styles.rsvpMonth}>
                                            {new Date(event.eventDate).toLocaleDateString('en-US', { month: 'short' })}
                                        </Text>
                                    </View>
                                    <View style={styles.rsvpInfo}>
                                        <View style={styles.eventTitleRow}>
                                            <Text style={styles.rsvpTitle} numberOfLines={1}>{event.title}</Text>
                                            <EventPriceBadge isFree={event.isFree !== false} price={event.price} variant="compact" />
                                        </View>
                                        <View style={styles.rsvpMeta}>
                                            <MaterialCommunityIcons name="clock-outline" size={12} color="rgba(255,255,255,0.4)" />
                                            <Text style={styles.rsvpMetaText}>{formatTime(event.eventDate)}</Text>
                                            {event.location && (
                                                <>
                                                    <MaterialCommunityIcons name="map-marker-outline" size={12} color="rgba(255,255,255,0.4)" />
                                                    <Text style={styles.rsvpMetaText} numberOfLines={1}>{event.location}</Text>
                                                </>
                                            )}
                                        </View>
                                    </View>
                                    <View style={[
                                        styles.rsvpStatusBadge,
                                        event.userRsvpStatus === 'waitlisted' && styles.rsvpStatusWaitlist
                                    ]}>
                                        <Text style={styles.rsvpStatusText}>
                                            {event.userRsvpStatus === 'waitlisted' ? 'Waitlist' : 'Booked'}
                                        </Text>
                                    </View>
                                </LinearGradient>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* Featured / Next Event Hero Card */}
                {upcomingEvents.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Featured Event</Text>
                        <TouchableOpacity
                            style={styles.featuredCard}
                            onPress={() => navigation.navigate('EventDetail', { eventId: upcomingEvents[0].id })}
                            activeOpacity={0.9}
                        >
                            <Image
                                source={{ uri: upcomingEvents[0].imageUrl || 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800' }}
                                style={styles.featuredImage}
                                resizeMode="cover"
                            />
                            <EventPriceBadge isFree={upcomingEvents[0].isFree !== false} price={upcomingEvents[0].price} variant="bubble" />
                            <LinearGradient
                                colors={['transparent', 'rgba(0,0,0,0.8)', '#000']}
                                style={styles.featuredGradient}
                            >
                                <View style={styles.featuredContent}>
                                    <View style={styles.featuredTag}>
                                        <Text style={styles.featuredTagText}>NEXT UP</Text>
                                    </View>
                                    <Text style={styles.featuredTitle}>{upcomingEvents[0].title}</Text>
                                    <View style={styles.featuredMeta}>
                                        <MaterialCommunityIcons name="clock-outline" size={14} color="#F1C93B" />
                                        <Text style={styles.featuredMetaText}>
                                            {formatDate(upcomingEvents[0].eventDate)} · {formatTime(upcomingEvents[0].eventDate)}
                                        </Text>
                                    </View>
                                    <View style={styles.featuredBottom}>
                                        <View style={styles.featuredCountdown}>
                                            <Text style={styles.countdownValue}>{getDaysUntil(upcomingEvents[0].eventDate)}</Text>
                                        </View>
                                        <TouchableOpacity
                                            style={styles.checkInButton}
                                            onPress={() => navigation.navigate('EventQRCheckIn')}
                                        >
                                            <Text style={styles.checkInButtonText}>Quick Check-in</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Upcoming Events */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Upcoming Events</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('EventCalendar')}>
                            <Text style={styles.sectionLink}>See All</Text>
                        </TouchableOpacity>
                    </View>

                    {upcomingEvents.length === 0 ? (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="calendar-blank-outline" size={48} color="rgba(255,255,255,0.15)" />
                            <Text style={styles.emptyStateText}>No events yet under this gym</Text>
                            <Text style={styles.emptyStateSubtext}>Check back soon!</Text>
                        </View>
                    ) : (
                        upcomingEvents.map((event) => (
                            <TouchableOpacity
                                key={event.id}
                                style={styles.eventCard}
                                onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
                                activeOpacity={0.8}
                            >
                                <View style={styles.eventCardLeft}>
                                    <View style={styles.eventDateBubble}>
                                        <Text style={styles.eventDateDay}>
                                            {new Date(event.eventDate).toLocaleDateString('en-US', { day: 'numeric' })}
                                        </Text>
                                        <Text style={styles.eventDateMonth}>
                                            {new Date(event.eventDate).toLocaleDateString('en-US', { month: 'short' })}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.eventCardContent}>
                                    <View style={styles.eventTitleRow}>
                                        <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
                                        <EventPriceBadge isFree={event.isFree !== false} price={event.price} variant="compact" />
                                    </View>
                                    <View style={styles.eventMeta}>
                                        <MaterialCommunityIcons name="clock-outline" size={12} color="rgba(255,255,255,0.4)" />
                                        <Text style={styles.eventMetaText}>{formatTime(event.eventDate)}</Text>
                                        {event.location && (
                                            <>
                                                <Text style={styles.eventMetaDot}>·</Text>
                                                <Text style={styles.eventMetaText} numberOfLines={1}>{event.location}</Text>
                                            </>
                                        )}
                                    </View>
                                    <View style={styles.eventFooter}>
                                        <View style={styles.eventCountdown}>
                                            <MaterialCommunityIcons name="timer-outline" size={11} color="#F1C93B" />
                                            <Text style={styles.eventCountdownText}>{getDaysUntil(event.eventDate)}</Text>
                                        </View>
                                        {event.capacity && (
                                            <Text style={styles.eventCapacity}>
                                                {event.rsvpCount || 0}/{event.capacity} spots
                                            </Text>
                                        )}
                                        {event.userRsvpStatus && (
                                            <View style={[
                                                styles.miniStatusBadge,
                                                event.userRsvpStatus === 'waitlisted' && styles.miniStatusWaitlist
                                            ]}>
                                                <Text style={styles.miniStatusText}>
                                                    {event.userRsvpStatus === 'waitlisted' ? 'Waitlist' : 'Booked'}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                                <MaterialCommunityIcons name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
                            </TouchableOpacity>
                        ))
                    )}
                </View>

                {/* Quick Actions */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                    <View style={styles.quickActions}>
                        <TouchableOpacity
                            style={styles.quickAction}
                            onPress={() => navigation.navigate('EventCalendar')}
                        >
                            <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(42,75,42,0.3)' }]}>
                                <MaterialCommunityIcons name="calendar-month" size={24} color="#4CAF50" />
                            </View>
                            <Text style={styles.quickActionText}>All Events</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.quickAction}
                            onPress={() => navigation.navigate('EventHistory')}
                        >
                            <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(96,165,250,0.15)' }]}>
                                <MaterialCommunityIcons name="history" size={24} color="#60a5fa" />
                            </View>
                            <Text style={styles.quickActionText}>My History</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.quickAction}
                            onPress={() => navigation.navigate('EventTribes')}
                        >
                            <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(168,85,247,0.15)' }]}>
                                <MaterialCommunityIcons name="forum-outline" size={24} color="#a855f7" />
                            </View>
                            <Text style={styles.quickActionText}>Community</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.quickAction}
                            onPress={() => navigation.navigate('EventQRCheckIn')}
                        >
                            <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(241,201,59,0.15)' }]}>
                                <MaterialCommunityIcons name="qrcode-scan" size={24} color="#F1C93B" />
                            </View>
                            <Text style={styles.quickActionText}>Check In</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Upgrade CTA Banner */}
                <TouchableOpacity
                    style={styles.upgradeBanner}
                    onPress={() => navigation.navigate('SubscriptionPlans')}
                    activeOpacity={0.85}
                >
                    <LinearGradient
                        colors={['rgba(42,75,42,0.4)', 'rgba(42,75,42,0.2)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.upgradeBannerGradient}
                    >
                        <View style={styles.upgradeBannerContent}>
                            <MaterialCommunityIcons name="dumbbell" size={28} color="#F1C93B" />
                            <View style={styles.upgradeBannerText}>
                                <Text style={styles.upgradeBannerTitle}>Unlock Full Gym Access</Text>
                                <Text style={styles.upgradeBannerSubtitle}>
                                    Workouts, progress tracking, gym calendar & more
                                </Text>
                            </View>
                        </View>
                        <MaterialCommunityIcons name="arrow-right" size={20} color="#F1C93B" />
                    </LinearGradient>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050B05' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    glow1: {
        position: 'absolute',
        width: 500, height: 500, borderRadius: 250,
        backgroundColor: 'rgba(42, 75, 42, 0.1)',
        top: -150, left: -150,
        zIndex: -1,
    },
    scrollContent: { paddingBottom: 120 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 20,
    },
    headerMain: { flex: 1 },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    avatarButton: {
        position: 'relative',
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1.5,
        borderColor: 'rgba(76, 175, 80, 0.4)',
    },
    avatarPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    avatarInitial: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    avatarGlow: {
        position: 'absolute',
        top: -2, left: -2, right: -2, bottom: -2,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(76, 175, 80, 0.2)',
        zIndex: -1,
    },
    gymBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4,
    },
    gymBadgeText: { fontSize: 11, color: '#F1C93B', fontWeight: '600' },
    eventAccessBadge: {
        backgroundColor: 'rgba(42,75,42,0.4)',
        paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    },
    eventAccessText: { fontSize: 8, color: '#4CAF50', fontWeight: '800', letterSpacing: 0.5 },
    statsRow: {
        flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginBottom: 24,
    },
    statCard: {
        flex: 1, backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 16, padding: 16, alignItems: 'center', gap: 4,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    },
    statCardUpgrade: { borderColor: 'rgba(241,201,59,0.2)' },
    statValue: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
    statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
    section: { paddingHorizontal: 20, marginBottom: 24 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
    sectionLink: { fontSize: 13, color: '#4CAF50', fontWeight: '600' },
    rsvpCard: { borderRadius: 16, overflow: 'hidden', marginBottom: 10 },
    rsvpCardGradient: {
        flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12,
        borderWidth: 1, borderColor: 'rgba(42,75,42,0.4)', borderRadius: 16,
    },
    rsvpDateBox: {
        width: 44, alignItems: 'center',
        backgroundColor: 'rgba(42,75,42,0.4)', borderRadius: 10, padding: 6,
    },
    rsvpDay: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
    rsvpMonth: { fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' },
    rsvpInfo: { flex: 1 },
    rsvpTitle: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 4, flex: 1 },
    rsvpMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    rsvpMetaText: { fontSize: 11, color: 'rgba(255,255,255,0.4)', maxWidth: 100 },
    rsvpStatusBadge: {
        backgroundColor: 'rgba(42,75,42,0.5)',
        paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    },
    rsvpStatusWaitlist: { backgroundColor: 'rgba(241,201,59,0.2)' },
    rsvpStatusText: { fontSize: 10, color: '#4CAF50', fontWeight: '700' },
    eventCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 16, padding: 14, marginBottom: 10, gap: 12,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    },
    eventCardLeft: {},
    eventDateBubble: {
        width: 48, alignItems: 'center',
        backgroundColor: 'rgba(42,75,42,0.25)', borderRadius: 12, padding: 8,
    },
    eventDateDay: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
    eventDateMonth: { fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' },
    eventCardContent: { flex: 1 },
    eventTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    eventTitle: { fontSize: 14, fontWeight: '700', color: '#fff', flex: 1 },
    eventMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
    eventMetaText: { fontSize: 11, color: 'rgba(255,255,255,0.4)', maxWidth: 120 },
    eventMetaDot: { color: 'rgba(255,255,255,0.2)', fontSize: 11 },
    eventFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    eventCountdown: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    eventCountdownText: { fontSize: 11, color: '#F1C93B', fontWeight: '600' },
    eventCapacity: { fontSize: 11, color: 'rgba(255,255,255,0.35)' },
    emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
    emptyStateText: { fontSize: 15, color: 'rgba(255,255,255,0.3)', fontWeight: '600' },
    emptyStateSubtext: { fontSize: 13, color: 'rgba(255,255,255,0.2)' },
    quickActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
    quickAction: { flex: 1, alignItems: 'center', gap: 8 },
    quickActionIcon: {
        width: 56, height: 56, borderRadius: 16,
        justifyContent: 'center', alignItems: 'center',
    },
    quickActionText: { fontSize: 11, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
    upgradeBanner: { marginHorizontal: 20, borderRadius: 18, overflow: 'hidden' },
    upgradeBannerGradient: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 18, borderWidth: 1, borderColor: 'rgba(42,75,42,0.5)', borderRadius: 18,
    },
    upgradeBannerContent: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
    upgradeBannerText: { flex: 1 },
    upgradeBannerTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
    upgradeBannerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
    bannerSection: {
        marginHorizontal: 20,
        marginBottom: 24,
        borderRadius: 16,
        overflow: 'hidden',
    },
    bannerCard: {
        height: 120,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    bannerImage: {
        width: '100%',
        height: '100%',
    },
    bannerOverlay: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(0,0,0,0.4)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    bannerTag: {
        color: '#F1C93B',
        fontSize: 8,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    paginationDots: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingTop: 8,
        gap: 6,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    activeDot: {
        backgroundColor: '#4CAF50',
        width: 14,
    },
    featuredCard: {
        height: 200,
        borderRadius: 24,
        overflow: 'hidden',
        marginTop: 8,
        backgroundColor: '#1b241b',
        elevation: 10,
        shadowColor: '#4CAF50',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
    },
    featuredImage: {
        width: '100%',
        height: '100%',
        position: 'absolute',
    },
    featuredGradient: {
        flex: 1,
        justifyContent: 'flex-end',
        padding: 20,
    },
    featuredContent: { gap: 8 },
    featuredTag: {
        backgroundColor: '#F1C93B',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    featuredTagText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#000',
    },
    featuredTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
    },
    featuredMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    featuredMetaText: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.7)',
        fontWeight: '500',
    },
    featuredBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
    },
    featuredCountdown: {
        backgroundColor: 'rgba(241,201,59,0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(241,201,59,0.2)',
    },
    countdownValue: {
        fontSize: 12,
        color: '#F1C93B',
        fontWeight: 'bold',
    },
    checkInButton: {
        backgroundColor: '#4CAF50',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
    },
    checkInButtonText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#fff',
    },
    miniStatusBadge: {
        backgroundColor: 'rgba(42,75,42,0.4)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginLeft: 8,
    },
    miniStatusWaitlist: {
        backgroundColor: 'rgba(241,201,59,0.2)',
    },
    miniStatusText: {
        fontSize: 9,
        color: '#4CAF50',
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
});
