import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Platform,
    ActivityIndicator,
    ScrollView,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { fetchMembershipForGate } from '../services/membershipGate';
import type { Gym } from '../types/auth';

interface Props {
    navigation: any;
    route: any;
}

type AccessMode = 'gym_access' | 'event_access';

const ACCESS_OPTIONS = [
    {
        mode: 'gym_access' as AccessMode,
        title: 'Gym Access',
        subtitle: 'Full gym membership experience',
        icon: 'dumbbell',
        color: '#2A4B2A',
        features: [
            'Workout & progress tracking',
            'Full nutrition system',
            'Gym class calendar',
            'Trainer oversight',
            'Membership management',
            'AI fitness coach',
        ],
        cta: 'Join as Gym Member',
        badge: 'PREMIUM',
        badgeColor: '#F1C93B',
    },
    {
        mode: 'event_access' as AccessMode,
        title: 'Event Access',
        subtitle: 'Community & outdoor events',
        icon: 'calendar-star',
        color: '#1a3a5c',
        features: [
            'Events calendar & sign up',
            'Full nutrition tracking',
            'Community chat',
            'AI fitness coach',
            'Event leaderboard',
            'QR event check-in',
        ],
        cta: 'Free Access',
        badge: 'FREE',
        badgeColor: '#22c55e',
    },
];

export default function AccessModeSelectionScreen({ navigation, route }: Props) {
    const { user, currentGym: authGym, logout } = useAuth();
    const { userId: paramUserId, gym: paramGym, hasEvents: paramHasEvents } = route.params || {};

    // Sources of truth: Params first (explicit), then Auth state (implicit)
    const userId = paramUserId || user?.id;
    const gym = paramGym || authGym;

    // Rule 1 & 2: Event Access must be disabled when gym has NO events. Fetch dynamically if not passed.
    const [hasEvents, setHasEvents] = useState<boolean>(paramHasEvents ?? false);
    const [loadingEvents, setLoadingEvents] = useState(false);

    useEffect(() => {
        if (paramHasEvents !== undefined) {
            setHasEvents(paramHasEvents);
            return;
        }
        if (!gym?.id) return;
        let cancelled = false;
        setLoadingEvents(true);
        (async () => {
            try {
                const { count, error } = await (supabase as any)
                    .from('events')
                    .select('*', { count: 'exact', head: true })
                    .eq('gym_id', gym.id)
                    .eq('is_active', true);

                if (!cancelled && !error) setHasEvents((count ?? 0) > 0);
            } catch (e) {
                if (!cancelled) setHasEvents(false);
            } finally {
                if (!cancelled) setLoadingEvents(false);
            }
        })();
        return () => { cancelled = true; };
    }, [gym?.id, paramHasEvents]);

    const [selected, setSelected] = useState<AccessMode | null>(null);
    const [saving, setSaving] = useState(false);

    // Clear invalid selection when hasEvents becomes false
    useEffect(() => {
        if (!hasEvents && selected === 'event_access') setSelected(null);
    }, [hasEvents, selected]);

    const handleContinue = async () => {
        if (!selected) {
            Alert.alert('Selection Required', 'Please select an access mode to continue.');
            return;
        }

        if (selected === 'event_access' && !hasEvents) {
            Alert.alert('Event Access Unavailable', 'This gym has no events scheduled yet. Please choose Gym Access.');
            return;
        }

        if (!userId) {
            console.error('[AccessMode] Missing userId');
            Alert.alert('Session Error', 'Your user session could not be verified. Please try logging in again.');
            return;
        }

        setSaving(true);
        try {
            console.log('[AccessMode] Saving selection...', { selected, userId });
            const crm_tag = selected === 'gym_access' ? 'gym_member' : 'event_only';

            // 1. Update Profile (Both access_mode AND gym_id for consistency)
            const { error } = await (supabase as any)
                .from('users')
                .update({
                    access_mode: selected,
                    crm_tag,
                    ...(gym?.id ? { gym_id: gym.id } : {}),
                })
                .eq('id', userId);

            if (error) throw error;

            // STRICT SEQUENCE ENFORCEMENT:
            // - gym_access: go to payment. ID issued after admin approval (AccessGate routes when approved).
            // - event_access: issue EVT-XXXXX immediately, then proceed to calibration.
            if (selected === 'gym_access') {
                // Guard: if user already has active membership for this gym, skip payment
                const membership = gym?.id
                    ? await fetchMembershipForGate(userId, gym.id, selected)
                    : null;
                const hasActive = membership?.membership_status === 'active' && membership?.approved;
                if (hasActive) {
                    navigation.replace('AccessGate');
                    return;
                }
                navigation.navigate('SubscriptionPlans', { userId, gym, accessMode: selected });
            } else {
                // Issue Event ID immediately
                const eventId = 'EVT-' + Math.random().toString(36).substring(2, 7).toUpperCase();
                console.log('[AccessMode] Issuing Event ID:', eventId);

                const { error: idError } = await (supabase as any)
                    .from('users')
                    .update({ unique_id: eventId, membership_status: 'Active' })
                    .eq('id', userId);

                if (idError) {
                    console.error('[AccessMode] Failed to issue Event ID:', idError);
                    Alert.alert(
                        'ID Generation Failed',
                        'Could not assign your member ID. Please try again.',
                    );
                    return;
                }

                console.log('[AccessMode] Event ID issued. Proceeding to HealthMetrics.');
                navigation.navigate('HealthMetrics', { userId, isHardGate: true });
            }
        } catch (err: any) {
            console.error('[AccessMode] Failed to save access mode:', err);
            Alert.alert(
                'Selection Failed',
                err.message || 'Could not save your access selection. Please check your connection and try again.'
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#0A120A', '#1B241B', '#080F08']}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
            />
            <View style={styles.glow1} pointerEvents="none" />
            <View style={styles.glow2} pointerEvents="none" />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.stepIndicator}>
                        <View style={[styles.stepDot, styles.stepDotDone]}>
                            <MaterialCommunityIcons name="check" size={10} color="#fff" />
                        </View>
                        <View style={[styles.stepLine, styles.stepLineDone]} />
                        <View style={[styles.stepDot, styles.stepDotActive]} />
                    </View>
                    <Text style={styles.stepLabel}>Step 2 of 2</Text>
                    <Text style={styles.gymBadge}>
                        <MaterialCommunityIcons name="dumbbell" size={12} color="#F1C93B" />
                        {'  '}{!!gym?.name ? gym.name : 'Your Gym'}
                    </Text>
                    <Text style={styles.title}>Choose Your Access</Text>
                    <Text style={styles.subtitle}>
                        How would you like to use the platform? You can switch later from your profile.
                    </Text>
                </View>

                {/* Access Mode Cards */}
                <View style={styles.cardsContainer}>
                    {ACCESS_OPTIONS.map((option) => {
                        const isEventAccessDisabled = option.mode === 'event_access' && !hasEvents;
                        const isSelectable = !isEventAccessDisabled;
                        const isSelected = selected === option.mode;
                        return (
                            <TouchableOpacity
                                key={option.mode}
                                style={[
                                    styles.card,
                                    isSelected && isSelectable && { borderColor: option.color, borderWidth: 2 },
                                    isEventAccessDisabled && styles.cardDisabled,
                                ]}
                                onPress={() => isSelectable && setSelected(option.mode)}
                                activeOpacity={isSelectable ? 0.85 : 1}
                                disabled={!isSelectable}
                            >
                                {/* Badge */}
                                <View style={[styles.badge, { backgroundColor: option.badgeColor + '22' }]}>
                                    <Text style={[styles.badgeText, { color: option.badgeColor }]}>
                                        {option.badge}
                                    </Text>
                                </View>

                                {/* Icon */}
                                <View style={[styles.iconContainer, { backgroundColor: option.color + '33' }]}>
                                    <MaterialCommunityIcons
                                        name={option.icon as any}
                                        size={32}
                                        color={option.color === '#2A4B2A' ? '#4CAF50' : '#60a5fa'}
                                    />
                                </View>

                                <Text style={styles.cardTitle}>{option.title}</Text>
                                <Text style={styles.cardSubtitle}>{option.subtitle}</Text>

                                {option.mode === 'event_access' && !hasEvents && (
                                    <View style={styles.noEventsPlaceholder}>
                                        <MaterialCommunityIcons name="calendar-blank" size={14} color="rgba(255,255,255,0.4)" />
                                        <Text style={styles.noEventsPlaceholderText}>No events scheduled yet</Text>
                                    </View>
                                )}

                                {/* Features */}
                                <View style={styles.featureList}>
                                    {option.features.map((feat) => (
                                        <View key={feat} style={styles.featureRow}>
                                            <MaterialCommunityIcons
                                                name="check-circle"
                                                size={14}
                                                color={option.mode === 'gym_access' ? '#4CAF50' : '#60a5fa'}
                                            />
                                            <Text style={styles.featureText}>{feat}</Text>
                                        </View>
                                    ))}
                                </View>

                                {/* Selection ring */}
                                {isSelected && (
                                    <View style={[styles.selectedRing, { borderColor: option.color }]}>
                                        <MaterialCommunityIcons name="check" size={16} color={option.color} />
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Upgrade note */}
                <View style={styles.upgradeNote}>
                    <MaterialCommunityIcons name="information-outline" size={14} color="rgba(255,255,255,0.4)" />
                    <Text style={styles.upgradeNoteText}>
                        Event Access users can upgrade to Gym Access anytime from their profile.
                    </Text>
                </View>

                {/* CTA Button */}
                <View style={styles.footer}>
                    {selected === 'event_access' ? (
                        // Event access CTA (no hard-coded pricing text)
                        <View style={styles.freeAccessContainer}>
                            <View style={styles.freeAccessPriceRow}>
                                <Text style={styles.freeAccessStrike}>Event Access Included</Text>
                                <View style={styles.freeAccessBadge}>
                                    <Text style={styles.freeAccessBadgeText}>LIMITED OFFER</Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                style={styles.continueBtn}
                                onPress={handleContinue}
                                disabled={saving}
                                activeOpacity={0.85}
                            >
                                <LinearGradient
                                    colors={['#22c55e', '#16a34a']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.continueBtnGradient}
                                >
                                    {saving ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <>
                                            <MaterialCommunityIcons name="lock-open-outline" size={20} color="#fff" />
                                            <Text style={styles.continueBtnText}>Free Access — Get Started</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={[styles.continueBtn, !selected && styles.continueBtnDisabled]}
                            onPress={handleContinue}
                            disabled={!selected || saving}
                            activeOpacity={0.85}
                        >
                            <LinearGradient
                                colors={selected ? ['#2A4B2A', '#3d6b3d'] : ['#1a1a1a', '#1a1a1a']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.continueBtnGradient}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <>
                                        <Text style={styles.continueBtnText}>
                                            {selected
                                                ? ACCESS_OPTIONS.find(o => o.mode === selected)?.cta
                                                : 'Select an Access Type'}
                                        </Text>
                                        {!!selected && (
                                            <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
                                        )}
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    )}
                    
                    {/* Logout Button */}
                    <TouchableOpacity
                        onPress={logout}
                        style={styles.logoutButton}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons name="logout" size={18} color="#FF6B6B" />
                        <Text style={styles.logoutText}>Logout</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#050B05',
    },
    glow1: {
        position: 'absolute',
        width: 500,
        height: 500,
        borderRadius: 250,
        backgroundColor: 'rgba(42, 75, 42, 0.12)',
        top: -150,
        left: -150,
        zIndex: -1,
    },
    glow2: {
        position: 'absolute',
        width: 400,
        height: 400,
        borderRadius: 200,
        backgroundColor: 'rgba(241, 190, 50, 0.08)', // Refined for better web rendering
        bottom: -100,
        right: -100,
        zIndex: -1,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    header: {
        paddingHorizontal: 24,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 20,
    },
    stepIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    stepDot: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepDotDone: {
        backgroundColor: '#2A4B2A',
    },
    stepDotActive: {
        backgroundColor: '#F1C93B',
        width: 20,
        height: 20,
    },
    stepLine: {
        width: 40,
        height: 2,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginHorizontal: 6,
    },
    stepLineDone: {
        backgroundColor: '#2A4B2A',
    },
    stepLabel: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.4)',
        fontWeight: '600',
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    gymBadge: {
        fontSize: 12,
        color: '#F1C93B',
        fontWeight: '700',
        marginBottom: 12,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        letterSpacing: 0.3,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
        lineHeight: 20,
    },
    cardsContainer: {
        paddingHorizontal: 20,
        gap: 16,
        marginTop: 8,
    },
    card: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        padding: 20,
        position: 'relative',
    },
    cardDisabled: {
        opacity: 0.5,
    },
    badge: {
        position: 'absolute',
        top: 16,
        right: 16,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
    },
    iconContainer: {
        width: 60,
        height: 60,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 14,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#fff',
        marginBottom: 4,
    },
    cardSubtitle: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.5)',
        marginBottom: 16,
    },
    featureList: {
        gap: 8,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    featureText: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.75)',
    },
    selectedRing: {
        position: 'absolute',
        top: 16,
        left: 16,
        width: 26,
        height: 26,
        borderRadius: 13,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    upgradeNote: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginHorizontal: 24,
        marginTop: 16,
    },
    upgradeNoteText: {
        flex: 1,
        fontSize: 12,
        color: 'rgba(255,255,255,0.35)',
        lineHeight: 18,
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    freeAccessContainer: {
        gap: 10,
    },
    freeAccessPriceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 4,
    },
    freeAccessStrike: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.3)',
        textDecorationLine: 'line-through',
    },
    freeAccessBadge: {
        backgroundColor: 'rgba(34,197,94,0.15)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    freeAccessBadgeText: {
        fontSize: 10,
        color: '#22c55e',
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    continueBtn: {
        height: 60,
        borderRadius: 18,
        overflow: 'hidden',
    },
    continueBtnDisabled: {
        opacity: 0.4,
    },
    continueBtnGradient: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
    },
    continueBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    noEventsPlaceholder: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.03)',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    noEventsPlaceholderText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.4)',
        fontWeight: '500',
    },
    logoutButton: {
        marginTop: 24,
        marginBottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#FF6B6B',
        backgroundColor: 'rgba(255, 107, 107, 0.1)',
    },
    logoutText: {
        color: '#FF6B6B',
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 1,
    },
});
