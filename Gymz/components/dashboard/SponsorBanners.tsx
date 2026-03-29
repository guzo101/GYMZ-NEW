import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Dimensions,
    Linking,
    Animated,
} from 'react-native';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';

const { width: screenWidth } = Dimensions.get('window');
const BANNER_WIDTH = screenWidth - 32;
const BANNER_ASPECT_RATIO = 4; // 4:1 ration as requested

interface BannerAd {
    id: string;
    image_url: string;
    link_url?: string;
    audience_type: 'all' | 'gym_members' | 'event_members';
}

export const SponsorBanners = () => {
    const { user, isGymMember, isEventMember } = useAuth();
    const [banners, setBanners] = useState<BannerAd[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (!user?.gymId) return;
        fetchBanners();

        // Pulsing animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.05,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [user?.gymId]);

    const fetchBanners = async () => {
        try {
            const { data, error } = await (supabase as any)
                .from('banner_ads')
                .select('id, image_url, link_url, audience_type')
                .eq('gym_id', user?.gymId)
                .eq('is_active', true)
                .in('placement_type', ['global', 'gym_home']);

            if (error) throw error;

            // Client-side filtering for audience
            const filtered = (data || []).filter((b: BannerAd) => {
                if (b.audience_type === 'all') return true;
                if (b.audience_type === 'gym_members' && isGymMember) return true;
                if (b.audience_type === 'event_members' && isEventMember) return true;
                return false;
            });

            setBanners(filtered);

            // Track impressions
            filtered.forEach(async (b: BannerAd) => {
                await (supabase as any).rpc('increment_banner_impression', { banner_id: b.id });
            });
        } catch (err) {
            console.error('[SponsorBanners] fetch error:', err);
        }
    };

    const handlePress = async (banner: BannerAd) => {
        if (!banner.link_url) return;
        try {
            await (supabase as any).rpc('increment_banner_click', { banner_id: banner.id });
            Linking.openURL(banner.link_url);
        } catch (err) {
            console.error('Failed to open banner link:', err);
        }
    };

    if (banners.length === 0) return null;

    return (
        <View style={styles.container}>
            <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={(e) => {
                    const offset = e.nativeEvent.contentOffset.x;
                    setActiveIndex(Math.round(offset / BANNER_WIDTH));
                }}
                scrollEventThrottle={16}
            >
                {banners.map((banner) => (
                    <Animated.View
                        key={banner.id}
                        style={[
                            styles.bannerWrapper,
                            { transform: [{ scale: pulseAnim }] }
                        ]}
                    >
                        <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={() => handlePress(banner)}
                            style={styles.bannerCard}
                        >
                            <Image
                                source={{ uri: banner.image_url }}
                                style={styles.bannerImage}
                                resizeMode="cover"
                            />
                            <View style={styles.tag}>
                                <Text style={styles.tagText}>PARTNER</Text>
                            </View>
                        </TouchableOpacity>
                    </Animated.View>
                ))}
            </ScrollView>

            {banners.length > 1 && (
                <View style={styles.dots}>
                    {banners.map((_, i) => (
                        <View
                            key={i}
                            style={[
                                styles.dot,
                                activeIndex === i && styles.activeDot
                            ]}
                        />
                    ))}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 4,
        alignItems: 'center',
    },
    bannerWrapper: {
        width: BANNER_WIDTH,
        marginHorizontal: 16,
    },
    bannerCard: {
        width: '100%',
        aspectRatio: BANNER_ASPECT_RATIO,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    bannerImage: {
        width: '100%',
        height: '100%',
    },
    tag: {
        position: 'absolute',
        top: 6,
        right: 6,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    tagText: {
        color: '#F1C93B',
        fontSize: 7,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    dots: {
        flexDirection: 'row',
        marginTop: 8,
        gap: 6,
    },
    dot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    activeDot: {
        backgroundColor: '#4CAF50',
        width: 10,
    },
});
