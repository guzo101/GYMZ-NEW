import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Alert,
    ActivityIndicator,
    Platform,
    Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import QRCode from 'react-native-qrcode-svg';
import { scheduleNotification } from '../services/notifications';
import { DataMapper } from '../utils/dataMapper';
import { EventPriceBadge } from '../components/EventPriceBadge';

const { width } = Dimensions.get('window');

interface Event {
    id: string;
    title: string;
    description?: string;
    location?: string;
    eventDate: string;
    endDate?: string;
    capacity?: number;
    rsvpCount: number;
    imageUrl?: string;
    isActive: boolean;
    gymId: string;
    isFree?: boolean;
    price?: number | null;
}

interface UserRSVP {
    id: string;
    status: 'confirmed' | 'waitlisted' | 'cancelled';
    qrToken?: string;
}

export default function EventDetailScreen({ route, navigation }: any) {
    const { eventId } = route.params;
    const { user } = useAuth();
    const [event, setEvent] = useState<Event | null>(null);
    const [userRsvp, setUserRsvp] = useState<UserRSVP | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const fetchEventData = useCallback(async () => {
        try {
            // Fetch event details
            const { data: eventData, error: eventError } = await (supabase as any)
                .from('events')
                .select('*')
                .eq('id', eventId)
                .single();

            if (eventError) throw eventError;

            // Fetch user RSVP status
            const { data: rsvpData } = await (supabase as any)
                .from('event_rsvps')
                .select('id, status, qr_token')
                .eq('event_id', eventId)
                .eq('user_id', user?.id)
                .maybeSingle();

            setEvent(DataMapper.fromDb(eventData));
            setUserRsvp(DataMapper.fromDb(rsvpData) || null);
        } catch (err) {
            console.error('[EventDetail] Fetch error:', err);
            Alert.alert('Error', 'Could not load event details.');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    }, [eventId, user?.id, navigation]);

    useEffect(() => {
        fetchEventData();
    }, [fetchEventData]);

    const handleRSVP = async () => {
        if (!event || !user) return;
        setActionLoading(true);
        try {
            const isFull = event.capacity && event.rsvpCount >= event.capacity;
            const status = isFull ? 'waitlisted' : 'confirmed';

            if (userRsvp) {
                // Update existing RSVP if cancelled
                const { error } = await (supabase as any)
                    .from('event_rsvps')
                    .update(DataMapper.toDb({ status, updatedAt: new Date().toISOString() }))
                    .eq('id', userRsvp.id);
                if (error) throw error;
            } else {
                // Create new RSVP
                const { error } = await (supabase as any)
                    .from('event_rsvps')
                    .insert(DataMapper.toDb({
                        eventId: event.id,
                        userId: user.id,
                        gymId: event.gymId,
                        status,
                    }));
                if (error) throw error;
            }

            if (status === 'confirmed') {
                const eventDate = new Date(event.eventDate);
                const reminderTime = new Date(eventDate.getTime() - 60 * 60 * 1000); // 1 hour before

                if (reminderTime > new Date()) {
                    try {
                        await scheduleNotification(
                            `Reminder: ${event.title}`,
                            `Your event starts in 1 hour at ${event.location || 'the gym'}. See you there!`,
                            reminderTime
                        );
                    } catch (notifErr) {
                        console.warn('[EventDetail] Reminder scheduling failed (RSVP still succeeded):', notifErr);
                    }
                }
            }

            Alert.alert(
                status === 'confirmed' ? 'Booking Confirmed' : 'Waitlisted',
                status === 'confirmed'
                    ? 'You are all set for the event. A reminder has been set for 1 hour before start.'
                    : 'This event is full. You have been added to the waitlist.'
            );
            fetchEventData();
        } catch (err) {
            console.error('[EventDetail] RSVP error:', err);
            Alert.alert('Error', 'Couldn\'t save your spot. Please try again.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleCancelRSVP = async () => {
        if (!userRsvp) return;

        Alert.alert(
            'Cancel booking',
            'Are you sure you want to remove yourself from this event?',
            [
                { text: 'Keep It', style: 'cancel' },
                {
                    text: 'Yes, cancel',
                    style: 'destructive',
                    onPress: async () => {
                        setActionLoading(true);
                        try {
                            const { error } = await (supabase as any)
                                .from('event_rsvps')
                                .update(DataMapper.toDb({ status: 'cancelled', updatedAt: new Date().toISOString() }))
                                .eq('id', userRsvp.id);

                            if (error) throw error;
                            Alert.alert('Cancelled', 'You\'re no longer signed up.');
                            fetchEventData();
                        } catch (err) {
                            console.error('[EventDetail] Cancel RSVP error:', err);
                            Alert.alert('Error', 'Couldn\'t cancel. Please try again.');
                        } finally {
                            setActionLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const formatDateTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return {
            date: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
            time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        };
    };

    if (loading || !event) {
        return (
            <View style={styles.loadingContainer}>
                <LinearGradient colors={['#0A120A', '#1B241B']} style={StyleSheet.absoluteFill} pointerEvents="none" />
                <ActivityIndicator size="large" color="#4CAF50" />
            </View>
        );
    }

    const dt = formatDateTime(event.eventDate);
    const isConfirmed = userRsvp?.status === 'confirmed';
    const isWaitlisted = userRsvp?.status === 'waitlisted';
    const isFull = event.capacity && event.rsvpCount >= event.capacity;

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#0A120A', '#1B241B', '#080F08']} style={StyleSheet.absoluteFill} pointerEvents="none" />

            {/* Header Image / Placeholder */}
            <View style={styles.imageContainer}>
                {event.imageUrl ? (
                    <Image source={{ uri: event.imageUrl }} style={styles.headerImage} />
                ) : (
                    <LinearGradient colors={['#2A4B2A', '#1B241B']} style={styles.headerPlaceholder}>
                        <MaterialCommunityIcons name="calendar-star" size={80} color="rgba(255,255,255,0.2)" />
                    </LinearGradient>
                )}
                <EventPriceBadge isFree={event.isFree !== false} price={event.price} variant="bubble" />
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <MaterialCommunityIcons name="chevron-left" size={28} color="#fff" />
                </TouchableOpacity>

                {/* Status Overlay */}
                {(isConfirmed || isWaitlisted) && (
                    <View style={[styles.statusOverlay, isWaitlisted && styles.statusOverlayWaitlist]}>
                        <MaterialCommunityIcons
                            name={isConfirmed ? "check-circle" : "clock-outline"}
                            size={16}
                            color="#fff"
                        />
                        <Text style={styles.statusOverlayText}>
                            {isConfirmed ? 'BOOKED' : 'WAITLISTED'}
                        </Text>
                    </View>
                )}
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.content}>
                    <Text style={styles.title}>{event.title}</Text>

                    {/* Info Grid */}
                    <View style={styles.infoGrid}>
                        <View style={styles.infoRow}>
                            <View style={styles.infoIconBox}>
                                <MaterialCommunityIcons name="calendar-blank" size={20} color="#4CAF50" />
                            </View>
                            <View>
                                <Text style={styles.infoLabel}>Date</Text>
                                <Text style={styles.infoValue}>{dt.date}</Text>
                            </View>
                        </View>

                        <View style={styles.infoRow}>
                            <View style={styles.infoIconBox}>
                                <MaterialCommunityIcons name="clock-outline" size={20} color="#4CAF50" />
                            </View>
                            <View>
                                <Text style={styles.infoLabel}>Time</Text>
                                <Text style={styles.infoValue}>{dt.time}</Text>
                            </View>
                        </View>

                        <View style={styles.infoRow}>
                            <View style={styles.infoIconBox}>
                                <MaterialCommunityIcons name="map-marker-outline" size={20} color="#4CAF50" />
                            </View>
                            <View>
                                <Text style={styles.infoLabel}>Location</Text>
                                <Text style={styles.infoValue}>{event.location || 'Venue details provided on check-in'}</Text>
                            </View>
                        </View>

                        {event.capacity && (
                            <View style={styles.infoRow}>
                                <View style={styles.infoIconBox}>
                                    <MaterialCommunityIcons name="account-group-outline" size={20} color="#4CAF50" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.infoLabel}>Capacity</Text>
                                    <View style={styles.capacityBarContainer}>
                                        <View style={styles.capacityBarBG}>
                                            <View
                                                style={[
                                                    styles.capacityBarFill,
                                                    {
                                                        width: `${Math.min(100, (event.rsvpCount / event.capacity) * 100)}%`,
                                                        backgroundColor: isFull ? '#ef4444' : '#4CAF50'
                                                    }
                                                ]}
                                            />
                                        </View>
                                        <Text style={styles.capacityText}>
                                            {event.rsvpCount}/{event.capacity} spots filled
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        )}
                    </View>

                    {/* Description */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>About this Event</Text>
                        <Text style={styles.description}>
                            {event.description || 'No description provided for this event. Stay tuned for more updates!'}
                        </Text>
                    </View>

                    {/* QR Code Section for Confirmed Users */}
                    {isConfirmed && userRsvp?.qrToken && (
                        <View style={styles.qrSection}>
                            <View style={styles.qrHeader}>
                                <Text style={styles.sectionTitle}>Your Entry Pass</Text>
                                <View style={styles.verifiedBadge}>
                                    <MaterialCommunityIcons name="check-decagram" size={14} color="#4CAF50" />
                                    <Text style={styles.verifiedText}>BOOKED</Text>
                                </View>
                            </View>
                            <View style={styles.qrCard}>
                                <View style={styles.qrContainer}>
                                    <QRCode
                                        value={`gymz_event_checkin:${event.id}:${userRsvp.qrToken}`}
                                        size={180}
                                        color="#000"
                                        backgroundColor="#fff"
                                        enableLinearGradient={true}
                                        linearGradient={['#2A4B2A', '#000']}
                                    />
                                </View>
                                <Text style={styles.qrHint}>Present this code at the venue entrance</Text>
                                <View style={styles.qrTokenRow}>
                                    <Text style={styles.qrTokenText}>#{userRsvp.qrToken.slice(0, 8).toUpperCase()}</Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Guidelines / Important Info */}
                    <View style={styles.guidelinesBox}>
                        <MaterialCommunityIcons name="information-outline" size={20} color="#F1C93B" />
                        <Text style={styles.guidelinesText}>
                            Please arrive 10 minutes early for check-in. Cancellation must be done 2 hours prior to the event.
                        </Text>
                    </View>
                </View>
            </ScrollView>

            {/* Sticky Bottom Button */}
            {(user?.accessMode === 'event_access' || user?.accessMode === 'gym_access') && (
                <View style={styles.bottomNav}>
                    {isConfirmed || isWaitlisted ? (
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={handleCancelRSVP}
                            disabled={actionLoading}
                        >
                            <Text style={styles.cancelButtonText}>Cancel Booking</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={[styles.rsvpButton, isFull ? styles.waitlistButton : undefined]}
                            onPress={handleRSVP}
                            disabled={actionLoading}
                        >
                            {actionLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <MaterialCommunityIcons name={isFull ? "clock-outline" : "calendar-check"} size={20} color="#fff" />
                                    <Text style={styles.rsvpButtonText}>
                                        {isFull ? 'Join Waitlist' : 'Book Spot'}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050B05' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    imageContainer: { height: 280, width: '100%', position: 'relative' },
    headerImage: { width: '100%', height: '100%' },
    headerPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
    backButton: {
        position: 'absolute', top: 50, left: 20,
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center', alignItems: 'center',
        zIndex: 10,
    },
    statusOverlay: {
        position: 'absolute', bottom: 20, left: 20,
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: '#4CAF50', paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10,
    },
    statusOverlayWaitlist: { backgroundColor: '#F1C93B' },
    statusOverlayText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
    scrollContent: { paddingBottom: 120 },
    content: { padding: 24 },
    title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 24 },
    infoGrid: { gap: 20, marginBottom: 32 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    infoIconBox: {
        width: 44, height: 44, borderRadius: 12,
        backgroundColor: 'rgba(42,75,42,0.2)',
        justifyContent: 'center', alignItems: 'center',
    },
    infoLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '600', marginBottom: 2 },
    infoValue: { fontSize: 15, color: '#fff', fontWeight: '500' },
    capacityBarContainer: { flex: 1, marginTop: 4 },
    capacityBarBG: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
    capacityBarFill: { height: '100%', borderRadius: 3 },
    capacityText: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6 },
    section: { marginBottom: 32 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 12 },
    description: { fontSize: 15, color: 'rgba(255,255,255,0.7)', lineHeight: 24 },
    guidelinesBox: {
        flexDirection: 'row', gap: 12, padding: 16,
        backgroundColor: 'rgba(241,201,59,0.05)',
        borderRadius: 16, borderWidth: 1, borderColor: 'rgba(241,201,59,0.1)',
    },
    guidelinesText: { flex: 1, fontSize: 13, color: '#F1C93B', lineHeight: 20 },
    bottomNav: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: '#0A120A', padding: 24, paddingBottom: Platform.OS === 'ios' ? 44 : 24,
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
    },
    rsvpButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        backgroundColor: '#4CAF50', height: 56, borderRadius: 16,
    },
    waitlistButton: { backgroundColor: '#2A4B2A' },
    rsvpButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    cancelButton: {
        alignItems: 'center', justifyContent: 'center',
        height: 56, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(239,68,68,0.5)',
    },
    cancelButtonText: { color: '#ef4444', fontSize: 16, fontWeight: 'bold' },
    qrSection: { marginBottom: 32 },
    qrHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(76,175,80,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    verifiedText: { fontSize: 10, color: '#4CAF50', fontWeight: 'bold' },
    qrCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#4CAF50',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    qrContainer: {
        padding: 10,
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 16,
    },
    qrHint: { fontSize: 12, color: '#666', fontWeight: '500', marginBottom: 12 },
    qrTokenRow: { backgroundColor: '#f5f5f5', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
    qrTokenText: { fontSize: 10, color: '#999', fontWeight: 'bold', letterSpacing: 1, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
