import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    Image,
    Platform,
    Modal,
    ScrollView,
    Dimensions,
    Animated,
    TouchableWithoutFeedback,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import type { Gym } from '../types/auth';
import { DataMapper } from '../utils/dataMapper';
import { PLATFORM_BENEFITS, buildGymInclusions } from '../services/pricingPlans';
import { EventPriceBadge } from '../components/EventPriceBadge';

const { width, height } = Dimensions.get('window');

const formatKwacha = (amount: number | string | null | undefined) => {
    const parsed = typeof amount === 'number' ? amount : Number(amount ?? 0);
    if (!Number.isFinite(parsed)) return 'K0';
    return `K${new Intl.NumberFormat('en-ZM', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(parsed)}`;
};

const formatPlanType = (planType?: string) => {
    switch (planType) {
        case 'daily':
            return 'Daily';
        case 'weekly':
            return 'Weekly';
        case 'monthly':
            return 'Monthly';
        case '3_months':
            return '3 Months';
        case '6_months':
            return '6 Months';
        case 'annual':
            return 'Annual';
        case 'custom':
            return 'Custom Plan';
        default:
            return planType || 'Membership';
    }
};

const isPlanVisibleForPath = (scope: unknown, selectedPath?: string | null) => {
    if (!selectedPath) return false;
    const normalizedScope = scope === 'event_access' || scope === 'both' ? scope : 'gym_access';
    return normalizedScope === 'both' || normalizedScope === selectedPath;
};

const getMediaUrl = (item: any) => item?.publicUrl || item?.fileUrl || item?.url || null;
const preferredMediaOrder = ['main_floor', 'free_weights', 'cardio', 'machines', 'entrance', 'exterior', 'reception', 'other'];

const pickPreferredFacilityImage = (assets: any[]) => {
    const withUrls = assets.filter(asset => !!getMediaUrl(asset));
    if (!withUrls.length) return null;
    return [...withUrls].sort((a, b) => {
        const aTypeRank = preferredMediaOrder.indexOf(a.assetType || 'other');
        const bTypeRank = preferredMediaOrder.indexOf(b.assetType || 'other');
        const safeARank = aTypeRank === -1 ? preferredMediaOrder.length : aTypeRank;
        const safeBRank = bTypeRank === -1 ? preferredMediaOrder.length : bTypeRank;
        if (safeARank !== safeBRank) return safeARank - safeBRank;
        return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
    })[0];
};

interface Props {
    navigation: any;
    route: any;
}

export default function GymSelectionScreen({ navigation, route }: Props) {
    const { user, logout } = useAuth();
    const { userId: paramUserId } = route.params || {};
    const userId = paramUserId ?? user?.id;
    const [gyms, setGyms] = useState<Gym[]>([]);
    const [gymPreviewImages, setGymPreviewImages] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    // Gym Discovery State
    const [selectedGym, setSelectedGym] = useState<Gym | null>(null);
    const [detailsModalVisible, setDetailsModalVisible] = useState(false);

    // Rich Data State
    const [media, setMedia] = useState<any[]>([]);
    const [equipment, setEquipment] = useState<any[]>([]);
    const [plans, setPlans] = useState<any[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);
    const [eventJoinModalVisible, setEventJoinModalVisible] = useState(false);
    const [tappedEvent, setTappedEvent] = useState<any>(null);

    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
    const [imageZoomVisible, setImageZoomVisible] = useState(false);
    const zoomOpacity = useRef(new Animated.Value(0)).current;
    const zoomScale = useRef(new Animated.Value(0.92)).current;

    useEffect(() => {
        fetchGyms();
    }, []);

    const fetchGyms = async () => {
        try {
            const { data, error } = await (supabase as any)
                .from('gyms')
                .select('*')
                .eq('status', 'active')
                .order('name', { ascending: true });

            if (error) throw error;
            const mappedGyms = DataMapper.fromDb(data) || [];
            setGyms(mappedGyms);

            const gymIds = mappedGyms.map((g: Gym) => g.id).filter(Boolean);
            if (gymIds.length > 0) {
                const { data: mediaData, error: mediaError } = await (supabase as any)
                    .from('gym_media_assets')
                    .select('*')
                    .in('gym_id', gymIds);

                if (!mediaError) {
                    const mappedMedia = DataMapper.fromDb(mediaData || []);
                    const byGym: Record<string, any[]> = {};
                    mappedMedia.forEach((asset: any) => {
                        if (!asset.gymId) return;
                        byGym[asset.gymId] = byGym[asset.gymId] || [];
                        byGym[asset.gymId].push(asset);
                    });

                    const previewMap: Record<string, string> = {};
                    Object.entries(byGym).forEach(([gymId, assets]) => {
                        const best = pickPreferredFacilityImage(assets);
                        const uri = best ? getMediaUrl(best) : null;
                        if (uri) previewMap[gymId] = uri;
                    });
                    setGymPreviewImages(previewMap);
                }
            }
        } catch (err) {
            console.error('[GymSelection] Failed to fetch gyms:', err);
        } finally {
            setLoading(false);
        }
    };

    const openImageZoom = (uri: string) => {
        setZoomedImageUrl(uri);
        setImageZoomVisible(true);
        zoomOpacity.setValue(0);
        zoomScale.setValue(0.92);
        Animated.parallel([
            Animated.timing(zoomOpacity, {
                toValue: 1,
                duration: 220,
                useNativeDriver: true,
            }),
            Animated.spring(zoomScale, {
                toValue: 1,
                friction: 8,
                tension: 75,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const closeImageZoom = () => {
        Animated.parallel([
            Animated.timing(zoomOpacity, {
                toValue: 0,
                duration: 160,
                useNativeDriver: true,
            }),
            Animated.timing(zoomScale, {
                toValue: 0.96,
                duration: 160,
                useNativeDriver: true,
            }),
        ]).start(() => {
            setImageZoomVisible(false);
            setZoomedImageUrl(null);
        });
    };

    const openGymDetails = async (gym: Gym) => {
        setSelectedGym(gym);
        setDetailsModalVisible(true);
        setLoadingDetails(true);
        try {
            // Concurrent fetch of rich data populated from OAC
            const [mediaRes, eqRes, planRes, eventsRes] = await Promise.all([
                (supabase as any).from('gym_media_assets').select('*').eq('gym_id', gym.id),
                (supabase as any).from('gym_facilities_equipment').select('*, gym_equipment_media(*)').eq('gym_id', gym.id),
                (supabase as any).from('gym_membership_plans').select('*').eq('gym_id', gym.id).eq('is_active', true),
                (supabase as any).from('events').select('*').eq('gym_id', gym.id).eq('is_active', true).gte('event_date', (() => { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString(); })()).limit(3)
            ]);

            setMedia(DataMapper.fromDb(mediaRes.data || []));
            setEquipment(DataMapper.fromDb(eqRes.data || []));
            const selectedPath = user?.accessMode || null;
            const pathScopedPlans = DataMapper.fromDb<any[]>(planRes.data || []).filter((plan: any) =>
                isPlanVisibleForPath(plan.accessModeScope, selectedPath)
            );
            setPlans(pathScopedPlans);
            setUpcomingEvents(DataMapper.fromDb(eventsRes.data || []));
        } catch (err) {
            console.error('[GymDiscovery] Error fetching deep details:', err);
        } finally {
            setLoadingDetails(false);
        }
    };


    const confirmSelection = async () => {
        if (!selectedGym) return;
        if (!userId) {
            // Guest mode: navigate to Signup with the selected gym
            navigation.navigate('Signup', { gymId: selectedGym.id });
            setDetailsModalVisible(false);
            return;
        }
        setSaving(true);
        try {
            // Check for active events (uses gym id, no user update needed)
            const { count, error: countError } = await (supabase as any)
                .from('events')
                .select('*', { count: 'exact', head: true })
                .eq('gym_id', selectedGym.id)
                .eq('is_active', true);

            if (countError) console.warn('[GymSelection] Error checking events:', countError);

            const hasEvents = (count || 0) > 0;

            // Defer gym_id update to AccessModeSelection — avoids trigger firing here
            // (ensure_member_unique_id can fail if gym prefix/sequences not ready).
            // AccessModeSelection updates gym_id when user picks their path.
            setDetailsModalVisible(false);
            navigation.navigate('AccessModeSelection', { userId, gym: selectedGym, hasEvents });
        } catch (err: any) {
            console.error('[GymSelection] Failed to proceed:', err);
            Alert.alert(
                'Something Went Wrong',
                err?.message || 'Failed to proceed. Please try again.',
                [{ text: 'OK' }]
            );
        } finally {
            setSaving(false);
        }
    };

    const handleEventTap = (event: any) => {
        setTappedEvent(event);
        setEventJoinModalVisible(true);
    };

    const closeEventJoinModal = () => {
        setEventJoinModalVisible(false);
        setTappedEvent(null);
    };

    const renderGym = ({ item }: { item: Gym }) => {
        const previewImage = gymPreviewImages[item.id];
        return (
            <TouchableOpacity
                style={styles.gymCard}
                onPress={() => openGymDetails(item)}
                activeOpacity={0.8}
            >
                <View style={styles.gymCardInner}>
                    <View style={styles.gymLogoContainer}>
                        {previewImage ? (
                            <Image source={{ uri: previewImage }} style={styles.gymPreviewImage} resizeMode="cover" />
                        ) : item.logoUrl ? (
                            <Image source={{ uri: item.logoUrl }} style={styles.gymLogo} resizeMode="contain" />
                        ) : (
                            <MaterialCommunityIcons name="dumbbell" size={28} color="#2A4B2A" />
                        )}
                    </View>
                    <View style={styles.gymInfo}>
                        <Text style={styles.gymName}>{item.name}</Text>
                        {!!item.location && (
                            <View style={styles.gymLocationRow}>
                                <MaterialCommunityIcons name="map-marker-outline" size={13} color="rgba(255,255,255,0.4)" />
                                <Text style={styles.gymLocation}>{item.location}</Text>
                            </View>
                        )}
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={24} color="rgba(255,255,255,0.3)" />
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#0A120A', '#1B241B', '#080F08']} style={StyleSheet.absoluteFill} pointerEvents="none" />

            <View style={styles.header}>
                <Text style={styles.stepLabel}>Welcome</Text>
                <Text style={styles.title}>Discover Gyms</Text>
                <Text style={styles.subtitle}>Select a facility to view its equipment, layout, and offers.</Text>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#2A4B2A" />
                </View>
            ) : (
                <View style={styles.contentWrapper}>
                    <FlatList
                        data={gyms}
                        keyExtractor={(item) => item.id}
                        renderItem={renderGym}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        style={{ flex: 1 }}
                    />
                    {userId ? (
                        <TouchableOpacity
                            onPress={() => logout()}
                            style={styles.logoutButton}
                            activeOpacity={0.7}
                        >
                            <MaterialCommunityIcons name="arrow-left" size={18} color="#FF6B6B" />
                            <Text style={styles.logoutText}>Back to Sign In</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            )}

            {/* Gym Discovery Drill-Down Modal */}
            <Modal
                visible={detailsModalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setDetailsModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <LinearGradient colors={['#131B13', '#080C08']} style={StyleSheet.absoluteFill} pointerEvents="none" />

                    {/* Sticky Modal Header */}
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setDetailsModalVisible(false)} style={styles.closeButton}>
                            <MaterialCommunityIcons name="close" size={24} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle} numberOfLines={1}>{selectedGym?.name}</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
                        {/* Media Section */}
                        {loadingDetails ? (
                            <ActivityIndicator size="large" color="#2A4B2A" style={{ marginVertical: 40 }} />
                        ) : (
                            <>
                                {!!media && media.length > 0 ? (
                                    <View style={styles.mediaCarousel}>
                                        <FlatList
                                            horizontal
                                            pagingEnabled
                                            showsHorizontalScrollIndicator={false}
                                            data={media}
                                            keyExtractor={(m) => m.id}
                                            renderItem={({ item }) => (
                                                getMediaUrl(item) ? (
                                                    <TouchableOpacity activeOpacity={0.98} onPress={() => openImageZoom(getMediaUrl(item) as string)} style={styles.carouselImageTapArea}>
                                                        <Image source={{ uri: getMediaUrl(item) }} style={styles.carouselImage} />
                                                        <View style={styles.zoomHintChip}>
                                                            <MaterialCommunityIcons name="magnify-plus-outline" size={14} color="#fff" />
                                                            <Text style={styles.zoomHintText}>Tap to expand</Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                ) : (
                                                    <View style={styles.noMediaContainer}>
                                                        <MaterialCommunityIcons name="image-off" size={32} color="rgba(255,255,255,0.2)" />
                                                        <Text style={styles.noMediaText}>Image unavailable</Text>
                                                    </View>
                                                )
                                            )}
                                        />
                                    </View>
                                ) : (
                                    <View style={styles.noMediaContainer}>
                                        <MaterialCommunityIcons name="camera-off" size={40} color="rgba(255,255,255,0.1)" />
                                        <Text style={styles.noMediaText}>Facility pictures coming soon</Text>
                                    </View>
                                )}
                                <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>Location</Text>
                                    <View style={styles.infoRow}>
                                        <MaterialCommunityIcons name="map-marker-radius" size={20} color="#2A4B2A" />
                                        <Text style={styles.infoText}>{selectedGym?.location || selectedGym?.city || "Location not provided"}</Text>
                                    </View>
                                </View>
                                {!!equipment && equipment.length > 0 && (
                                    <View style={styles.section}>
                                        <Text style={styles.sectionTitle}>Facilities & Equipment</Text>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.equipmentCardScroll} contentContainerStyle={styles.equipmentCardContent}>
                                            {equipment.map(eq => {
                                                const hasMedia = !!eq.gymEquipmentMedia && eq.gymEquipmentMedia.length > 0;
                                                const mediaUrl = hasMedia ? eq.gymEquipmentMedia[0].publicUrl : null;
                                                return (
                                                    <View key={eq.id} style={styles.equipmentCard}>
                                                        <View style={styles.equipmentImageContainer}>
                                                            {mediaUrl ? (
                                                                <TouchableOpacity style={styles.imageTapArea} activeOpacity={0.95} onPress={() => openImageZoom(mediaUrl)}>
                                                                    <Image source={{ uri: mediaUrl }} style={styles.equipmentImage} />
                                                                </TouchableOpacity>
                                                            ) : (
                                                                <View style={styles.equipmentPlaceholder}>
                                                                    <MaterialCommunityIcons name="dumbbell" size={24} color="rgba(255,255,255,0.1)" />
                                                                </View>
                                                            )}
                                                            <View style={styles.equipmentCategoryBadge}>
                                                                <Text style={styles.equipmentCategoryText}>{eq.category}</Text>
                                                            </View>
                                                        </View>
                                                        <View style={styles.equipmentInfo}>
                                                            <Text style={styles.equipmentNameText} numberOfLines={1}>{eq.itemName}</Text>
                                                            <Text style={styles.equipmentQtyText}>Quantity: {eq.itemCount || 1}</Text>
                                                        </View>
                                                    </View>
                                                );
                                            })}
                                        </ScrollView>
                                    </View>
                                )}
                                {/* Community Events: show when eventsEnabled is not explicitly false, or when gym has events */}
                                {(selectedGym?.eventsEnabled !== false || (upcomingEvents && upcomingEvents.length > 0)) && (
                                    <View style={styles.section}>
                                        <Text style={styles.sectionTitle}>Community Events</Text>
                                        {!!upcomingEvents && upcomingEvents.length > 0 ? (
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.equipmentCardScroll} contentContainerStyle={styles.equipmentCardContent}>
                                                {upcomingEvents.map(event => (
                                                    <TouchableOpacity
                                                        key={event.id}
                                                        style={[
                                                            styles.eventSmallCard,
                                                            tappedEvent?.id === event.id && styles.eventSmallCardHighlight,
                                                        ]}
                                                        onPress={() => handleEventTap(event)}
                                                        activeOpacity={0.8}
                                                    >
                                                        <View style={styles.eventImageContainer}>
                                                            {event.imageUrl ? (
                                                                <Image source={{ uri: event.imageUrl }} style={styles.eventImage} />
                                                            ) : (
                                                                <View style={styles.eventPlaceholder}>
                                                                    <MaterialCommunityIcons name="calendar" size={24} color="rgba(255,255,255,0.1)" />
                                                                </View>
                                                            )}
                                                            <EventPriceBadge isFree={event.isFree !== false} price={event.price} variant="bubble" />
                                                        </View>
                                                        <View style={styles.eventInfo}>
                                                            <Text style={styles.eventNameText} numberOfLines={1}>{event.title}</Text>
                                                            <Text style={styles.eventDateText}>{new Date(event.eventDate).toLocaleDateString()}</Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        ) : (
                                            <View style={styles.emptyEventsBox}>
                                                <MaterialCommunityIcons name="calendar-blank" size={32} color="rgba(255,255,255,0.15)" />
                                                <Text style={styles.emptyEventsText}>No events yet under this gym</Text>
                                            </View>
                                        )}
                                    </View>
                                )}
                                {!!plans && plans.length > 0 && (
                                    <View style={styles.section}>
                                        <Text style={styles.sectionTitle}>Membership Offers</Text>
                                        {plans.map(plan => {
                                            const planName = plan.planName || plan.name || 'Membership Plan';
                                            const billingCycle = formatPlanType(plan.planType || plan.billingCycle);
                                            const perks = [...PLATFORM_BENEFITS, ...buildGymInclusions(plan)];
                                            return (
                                            <View key={plan.id} style={styles.planCard}>
                                                <View>
                                                    <Text style={styles.planName}>{planName}</Text>
                                                    <Text style={styles.planBilling}>{billingCycle}</Text>
                                                    {!!perks.length && (
                                                        <Text style={styles.planDetails} numberOfLines={2}>
                                                            {perks.join('  •  ')}
                                                        </Text>
                                                    )}
                                                </View>
                                                <Text style={styles.planPrice}>{formatKwacha(plan.price)}</Text>
                                            </View>
                                            );
                                        })}
                                    </View>
                                )}
                                {(!plans || plans.length === 0) && (
                                    <View style={styles.section}>
                                        <Text style={styles.sectionTitle}>Membership Offers</Text>
                                        <View style={styles.emptyEventsBox}>
                                            <MaterialCommunityIcons name="alert-circle-outline" size={26} color="rgba(255,255,255,0.3)" />
                                            <Text style={styles.emptyEventsText}>
                                                {user?.accessMode
                                                    ? 'Pricing not available for this gym and access path.'
                                                    : 'Select an access path first to view pricing for this gym.'}
                                            </Text>
                                            <Text style={styles.planDetails}>
                                                Checkout is blocked unless plans exist for selected gym and selected path.
                                            </Text>
                                        </View>
                                    </View>
                                )}
                                <View style={{ height: 100 }} />
                            </>
                        )}
                    </ScrollView>

                    {/* Sticky Action Footer */}
                    <View style={styles.modalFooter}>
                        <TouchableOpacity
                            style={[styles.continueBtn, saving && styles.continueBtnDisabled]}
                            onPress={confirmSelection}
                            disabled={saving || loadingDetails}
                            activeOpacity={0.85}
                        >
                            <LinearGradient colors={['#2A4B2A', '#3d6b3d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.continueBtnGradient}>
                                {saving ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <>
                                        <Text style={styles.continueBtnText}>Join {selectedGym?.name}</Text>
                                        <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Event Join Modal - themed popup for explorers */}
            <Modal
                visible={eventJoinModalVisible}
                transparent
                animationType="fade"
                onRequestClose={closeEventJoinModal}
            >
                <View style={styles.eventJoinModalBackdrop}>
                    <TouchableWithoutFeedback onPress={closeEventJoinModal}>
                        <View style={StyleSheet.absoluteFill} />
                    </TouchableWithoutFeedback>
                    <View style={styles.eventJoinModalCard}>
                        <LinearGradient colors={['#0A120A', '#1B241B', '#080F08']} style={StyleSheet.absoluteFill} />
                        <View style={styles.eventJoinModalContent}>
                            <Text style={styles.eventJoinModalTitle}>Join for More Information</Text>
                            {!!tappedEvent && (
                                <View style={styles.eventJoinModalEventRow}>
                                    <Text style={styles.eventJoinModalEventName} numberOfLines={1}>{tappedEvent.title}</Text>
                                    <EventPriceBadge isFree={tappedEvent.isFree !== false} price={tappedEvent.price} variant="bubbleInline" />
                                </View>
                            )}
                            <Text style={styles.eventJoinModalBody}>
                                Spaces are running out!{tappedEvent?.isFree !== false ? " It's FREE!" : ''}
                            </Text>
                            <Text style={styles.eventJoinModalSub}>
                                Join now to see full event details and secure your spot.
                            </Text>
                            <View style={styles.eventJoinModalActions}>
                                <TouchableOpacity style={styles.eventJoinModalCancel} onPress={closeEventJoinModal} activeOpacity={0.8}>
                                    <Text style={styles.eventJoinModalCancelText}>Maybe Later</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.eventJoinModalJoin} onPress={() => { closeEventJoinModal(); confirmSelection(); }} activeOpacity={0.85}>
                                    <LinearGradient colors={['#2A4B2A', '#3d6b3d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.eventJoinModalJoinGradient}>
                                        <Text style={styles.eventJoinModalJoinText}>Join</Text>
                                        <MaterialCommunityIcons name="arrow-right" size={18} color="#fff" />
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Image Zoom Modal */}
            <Modal
                visible={imageZoomVisible}
                transparent
                animationType="none"
                onRequestClose={closeImageZoom}
            >
                <View style={styles.zoomModalRoot}>
                    <TouchableWithoutFeedback onPress={closeImageZoom}>
                        <Animated.View style={[styles.zoomBackdrop, { opacity: zoomOpacity }]} />
                    </TouchableWithoutFeedback>

                    <View style={styles.zoomContentWrap} pointerEvents="box-none">
                        <TouchableOpacity style={styles.zoomCloseButton} onPress={closeImageZoom} activeOpacity={0.85}>
                            <MaterialCommunityIcons name="close" size={22} color="#fff" />
                        </TouchableOpacity>

                        <Animated.View style={[styles.zoomImageCard, { opacity: zoomOpacity, transform: [{ scale: zoomScale }] }]}>
                            {!!zoomedImageUrl && <Image source={{ uri: zoomedImageUrl }} style={styles.zoomedImage} />}
                        </Animated.View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050B05' },
    header: { paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 20 },
    stepLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
    title: { fontSize: 28, fontWeight: 'bold', color: '#fff', letterSpacing: 0.3, marginBottom: 8 },
    subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 20 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    contentWrapper: { flex: 1 },
    listContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
    gymCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    gymCardInner: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
    gymLogoContainer: { width: 56, height: 56, borderRadius: 14, backgroundColor: 'rgba(42,75,42,0.15)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(42,75,42,0.3)' },
    gymLogo: { width: 36, height: 36 },
    gymPreviewImage: { width: 56, height: 56, borderRadius: 14 },
    gymInfo: { flex: 1, gap: 4 },
    gymName: { fontSize: 16, fontWeight: '700', color: '#fff' },
    gymLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    gymLocation: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },

    // Modal Styles
    modalContainer: { flex: 1, backgroundColor: '#080C08' },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 50 : 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', backgroundColor: 'rgba(8,12,8,0.9)' },
    closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', flex: 1, textAlign: 'center' },
    modalScroll: { flex: 1 },
    modalScrollContent: { paddingBottom: 40 },
    mediaCarousel: { width: width, height: 260, backgroundColor: '#000' },
    carouselImageTapArea: { width: width, height: 260 },
    carouselImage: { width: width, height: 260, resizeMode: 'cover' },
    imageTapArea: { width: '100%', height: '100%' },
    zoomHintChip: { position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
    zoomHintText: { color: '#fff', fontSize: 11, fontWeight: '600' },
    noMediaContainer: { width: width, height: 200, backgroundColor: 'rgba(255,255,255,0.02)', justifyContent: 'center', alignItems: 'center', gap: 10 },
    noMediaText: { color: 'rgba(255,255,255,0.3)', fontSize: 14 },
    section: { paddingHorizontal: 20, paddingTop: 24, gap: 12 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12 },
    infoText: { color: 'rgba(255,255,255,0.8)', fontSize: 15 },
    equipmentCardScroll: { marginHorizontal: -20, marginTop: 4 },
    equipmentCardContent: { paddingHorizontal: 20, gap: 12 },
    equipmentCard: { width: 140, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
    equipmentImageContainer: { width: '100%', height: 100, backgroundColor: 'rgba(255,255,255,0.05)' },
    equipmentImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    equipmentPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    equipmentCategoryBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    equipmentCategoryText: { color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
    equipmentInfo: { padding: 10, gap: 2 },
    equipmentNameText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
    equipmentQtyText: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
    planCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    planName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    planBilling: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 2 },
    planDetails: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 6, maxWidth: width * 0.55 },
    planPrice: { color: '#F1C93B', fontSize: 20, fontWeight: 'bold' },

    modalFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 20, paddingTop: 15, backgroundColor: 'rgba(8,12,8,0.9)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
    continueBtn: { height: 60, borderRadius: 18, overflow: 'hidden' },
    continueBtnDisabled: { opacity: 0.5 },
    continueBtnGradient: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
    continueBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    // Event Small Card Styles
    eventSmallCard: { width: 160, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
    eventSmallCardHighlight: { borderColor: '#4CAF50', borderWidth: 2, backgroundColor: 'rgba(76,175,80,0.12)' },
    eventImageContainer: { width: '100%', height: 90, backgroundColor: 'rgba(255,255,255,0.05)', position: 'relative' },
    eventImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    eventPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    eventInfo: { padding: 10, gap: 2 },
    eventNameText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
    eventDateText: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
    emptyEventsBox: { backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 16, padding: 24, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 8 },
    emptyEventsText: { color: 'rgba(255,255,255,0.3)', fontSize: 14, fontWeight: '500' },
    logoutButton: {
        marginTop: 24,
        marginBottom: 20,
        marginHorizontal: 20,
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
    // Event Join Modal (themed popup)
    eventJoinModalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.75)' },
    eventJoinModalCard: { width: width - 48, maxWidth: 340, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(42,75,42,0.5)' },
    eventJoinModalContent: { padding: 24, gap: 12 },
    eventJoinModalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
    eventJoinModalEventRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: 'rgba(76,175,80,0.15)', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(76,175,80,0.3)' },
    eventJoinModalEventName: { fontSize: 16, fontWeight: '600', color: '#fff', flex: 1 },
    eventJoinModalBody: { fontSize: 16, color: '#F1C93B', fontWeight: '600', textAlign: 'center' },
    eventJoinModalSub: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 20 },
    eventJoinModalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
    eventJoinModalCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center' },
    eventJoinModalCancelText: { color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: '600' },
    eventJoinModalJoin: { flex: 1, borderRadius: 12, overflow: 'hidden' },
    eventJoinModalJoinGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
    eventJoinModalJoinText: { color: '#fff', fontSize: 15, fontWeight: '700' },

    zoomModalRoot: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    zoomBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.88)' },
    zoomContentWrap: { width: '100%', alignItems: 'center', paddingHorizontal: 16 },
    zoomCloseButton: { alignSelf: 'flex-end', marginBottom: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
    zoomImageCard: {
        width: width - 24,
        height: Math.min(height * 0.72, width * 1.2),
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#000',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    zoomedImage: { width: '100%', height: '100%', resizeMode: 'contain', backgroundColor: '#000' },
});

