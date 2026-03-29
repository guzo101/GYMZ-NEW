import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Dimensions,
    TouchableOpacity,
    Platform
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../hooks/useTheme';
import { retentionService, RetentionEvent, RETENTION_PRIORITY } from '../../services/retentionService';
import { useRetention } from '../../hooks/useRetention';

const { width } = Dimensions.get('window');

/**
 * RetentionNudge Component
 * Handles variations of compact UI nudges:
 * 1. iPhone Island Style (Top Toast) for Critical alerts.
 * 2. Duolingo Style (Bottom Card) for High priority alerts.
 */
export const RetentionNudge: React.FC = () => {
    const { activeNudge, acknowledgeEvent, metrics } = useRetention();
    const { theme } = useTheme();
    const [currentNudge, setCurrentNudge] = useState<RetentionEvent | null>(null);

    const translateY = useRef(new Animated.Value(-100)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const bottomTranslateY = useRef(new Animated.Value(200)).current;

    useEffect(() => {
        if (activeNudge && !currentNudge) {
            showNudge(activeNudge);
        } else if (!activeNudge && currentNudge) {
            hideNudge();
        }
    }, [activeNudge]);

    const showNudge = (nudge: RetentionEvent) => {
        setCurrentNudge(nudge);

        if (nudge.priority === RETENTION_PRIORITY.CRITICAL) {
            // iPhone Island Style (Top)
            Animated.parallel([
                Animated.spring(translateY, {
                    toValue: Platform.OS === 'ios' ? 50 : 20,
                    useNativeDriver: true,
                    damping: 15,
                    stiffness: 100,
                }),
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                })
            ]).start();
        } else {
            // Duolingo Style (Bottom)
            Animated.spring(bottomTranslateY, {
                toValue: 0,
                useNativeDriver: true,
                damping: 12,
                stiffness: 90,
            }).start();
        }
    };

    const hideNudge = () => {
        if (!currentNudge) return;

        if (currentNudge.priority === RETENTION_PRIORITY.CRITICAL) {
            Animated.parallel([
                Animated.timing(translateY, {
                    toValue: -100,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                })
            ]).start(() => setCurrentNudge(null));
        } else {
            Animated.timing(bottomTranslateY, {
                toValue: 200,
                duration: 300,
                useNativeDriver: true,
            }).start(() => setCurrentNudge(null));
        }
    };

    const handlePress = async () => {
        if (currentNudge) {
            await acknowledgeEvent(currentNudge.id);
            hideNudge();
        }
    };

    if (!currentNudge) return null;

    // --- Dynamic Tone Layer ---
    const zTone = retentionService.getCoachZTone(metrics?.pulseStreakCount || 0, currentNudge.priority);
    const isEventNudge = currentNudge.eventType?.includes('event');

    // Tone-based visual logic
    const baseAccentColor = isEventNudge ? '#A855F7' : theme.primary;
    const finalAccentColor = zTone.tone === 'guilt' ? '#EF4444' : baseAccentColor;
    const iconName = isEventNudge ? 'calendar-star' : (zTone.tone === 'scientific' ? 'brain' : 'lightning-bolt');

    // ── iPhone Island Toast (Top) ──────────────────────────
    if (currentNudge.priority === RETENTION_PRIORITY.CRITICAL) {
        return (
            <Animated.View
                pointerEvents="box-none"
                style={[
                    styles.topIslandContainer,
                    { transform: [{ translateY }], opacity }
                ]}
            >
                {Platform.OS === 'web' ? (
                    <View style={[styles.islandBlur, { backgroundColor: 'rgba(0,0,0,0.75)' }]}>
                        <TouchableOpacity activeOpacity={0.8} style={styles.islandContent} onPress={handlePress}>
                            <View style={[styles.iconContainer, { backgroundColor: finalAccentColor }]}>
                                <MaterialCommunityIcons name={iconName} size={16} color="#FFF" />
                            </View>
                            <Text style={styles.islandText} numberOfLines={1}>{currentNudge.message}</Text>
                            <MaterialCommunityIcons name="chevron-right" size={18} color="rgba(255,255,255,0.6)" />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <BlurView intensity={80} tint="dark" style={styles.islandBlur}>
                        <TouchableOpacity activeOpacity={0.8} style={styles.islandContent} onPress={handlePress}>
                            <View style={[styles.iconContainer, { backgroundColor: finalAccentColor }]}>
                                <MaterialCommunityIcons name={iconName} size={16} color="#FFF" />
                            </View>
                            <Text style={styles.islandText} numberOfLines={1}>{currentNudge.message}</Text>
                            <MaterialCommunityIcons name="chevron-right" size={18} color="rgba(255,255,255,0.6)" />
                        </TouchableOpacity>
                    </BlurView>
                )}
            </Animated.View>
        );
    }

    // ── Duolingo Bottom Card (Bottom) ───────────────────────
    // pointerEvents="box-none" so touches pass through to Back to Sign In / other bottom buttons
    return (
        <Animated.View
            pointerEvents="box-none"
            style={[
                styles.bottomCardContainer,
                { transform: [{ translateY: bottomTranslateY }] }
            ]}
        >
            <View style={[styles.bottomCard, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}>
                <View style={styles.bottomCardContent}>
                    <View style={styles.mascotContainer}>
                        {/* Coach Z Avatar Placeholder */}
                        <View style={[styles.mascotCircle, { backgroundColor: finalAccentColor + '20' }]}>
                            <MaterialCommunityIcons
                                name={isEventNudge ? "human-greeting-proximity" : (zTone.tone === 'scientific' ? 'brain' : "face-recognition")}
                                size={24}
                                color={finalAccentColor}
                            />
                        </View>
                    </View>
                    <View style={styles.textContainer}>
                        <Text style={[styles.bottomCardTitle, { color: finalAccentColor }]}>{zTone.title}</Text>
                        <Text style={[styles.bottomCardMessage, { color: theme.text }]}>
                            {currentNudge.message}
                        </Text>
                    </View>
                </View>
                <TouchableOpacity
                    style={[styles.bottomCardButton, { backgroundColor: finalAccentColor }]}
                    onPress={handlePress}
                >
                    <Text style={styles.bottomCardButtonText}>{isEventNudge ? "I'M IN" : "LET'S GO"}</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    topIslandContainer: {
        position: 'absolute',
        top: 0,
        left: 20,
        right: 20,
        zIndex: 10000,
        alignItems: 'center',
    },
    islandBlur: {
        borderRadius: 25,
        overflow: 'hidden',
        width: '100%',
        height: 50,
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    islandContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        gap: 10,
    },
    iconContainer: {
        width: 26,
        height: 26,
        borderRadius: 13,
        justifyContent: 'center',
        alignItems: 'center',
    },
    islandText: {
        flex: 1,
        color: '#FFF',
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    bottomCardContainer: {
        position: 'absolute',
        bottom: 200,
        left: 20,
        right: 20,
        zIndex: 9000,
    },
    bottomCard: {
        padding: 16,
        borderRadius: 24,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    bottomCardContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
        gap: 12,
    },
    mascotContainer: {
        width: 48,
        height: 48,
    },
    mascotCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textContainer: {
        flex: 1,
    },
    bottomCardTitle: {
        fontSize: 12,
        fontWeight: '800',
        textTransform: 'uppercase',
        marginBottom: 4,
        letterSpacing: 1,
    },
    bottomCardMessage: {
        fontSize: 16,
        fontWeight: '600',
        lineHeight: 22,
    },
    bottomCardButton: {
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bottomCardButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.5,
    }
});
