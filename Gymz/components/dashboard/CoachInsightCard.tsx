import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { designSystem } from '../../theme/designSystem';
import { useTheme } from '../../hooks/useTheme';
import { humanizeGoal, humanizePersonality, humanizeStreak } from '../../utils/humanizer';

/** Payload for computing coach insight (shared by card and widget). */
export interface CoachInsightPayload {
    userMemory: any;
    stats: any;
    isInTribe?: boolean;
    preferredTime?: string | null;
    hasGaps?: boolean;
    gender?: string | 'male' | 'female';
}

export interface CoachInsightResult {
    text: string;
    icon: string;
    action: { route: string; params?: any };
}

/** Shared logic so widget can compute same insight from context payload. */
export function getCoachInsight(p: CoachInsightPayload): CoachInsightResult {
    const { userMemory, stats, isInTribe, preferredTime, hasGaps } = p;
    const gender = p.gender || 'male';
    const isFemale = gender === 'female';
    if (hasGaps) {
        return {
            text: isFemale
                ? "I need your coordinates to guide you. Let's calibrate your profile so I can point you toward your true potential."
                : "A compass is useless without coordinates. Update your metrics so I can plot the most efficient path to your goal.",
            icon: "compass-outline",
            action: { route: 'HealthMetrics' }
        };
    }
    if (!userMemory) {
        return {
            text: isFemale
                ? "Welcome. I am your navigator. Focus on the step in front of you, and I will handle the destination."
                : "Welcome. I am your compass. You bring the effort, I'll provide the direction. Let's get to work.",
            icon: "compass-rose",
            action: { route: 'Progress' }
        };
    }
    const personalitySlug = userMemory.communication_style || userMemory.personality_type || 'athlete';
    const personality = humanizePersonality(personalitySlug);
    const goal = humanizeGoal(userMemory.primary_goal || 'fitness');
    const memories = userMemory.key_memories || [];
    if (memories.length > 0 && Math.random() > 0.6) {
        const memory = memories[Math.floor(Math.random() * memories.length)];
        const msg = isFemale
            ? `You started this for "${memory}". Keep that 'why' close. It is the North Star for your decisions today.`
            : `Remember your mission: "${memory}". Stay true to that bearing. Do not drift.`;
        return { text: msg, icon: "map-marker-path", action: { route: 'Progress' } };
    }
    if (preferredTime) {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const [prefHour, prefMin] = preferredTime.split(':').map(Number);
        const diffInMinutes = (prefHour * 60 + prefMin) - (currentHour * 60 + currentMinute);
        if (diffInMinutes > 0 && diffInMinutes <= 60) {
            return {
                text: isFemale
                    ? `Your "Gold Hour" at ${preferredTime} is almost here. Take a moment to breathe and center yourself.`
                    : `Your "Gold Hour" at ${preferredTime} implies go-time. Lock in your focus and hydrate.`,
                icon: "clock-check-outline",
                action: { route: 'GymCalendar' }
            };
        }
    }
    if (stats.calories === 0) {
        return {
            text: isFemale
                ? "You can't travel far on an empty tank. Log your intake so we can ensure you have the energy to go the distance."
                : "Your engine dictates your pace. Log your fuel so I can navigate you toward peak performance.",
            icon: "fuel",
            action: { route: 'Nutrition' }
        };
    }
    if (stats.protein < (stats.goals?.protein || 150) * 0.5) {
        return {
            text: isFemale
                ? `Recovery is part of the journey. Secure more protein to ensure you're building the strength you need.`
                : `You're trailing on protein. Reinforce your structure now to stay battle-ready for ${goal}.`,
            icon: "shield-check",
            action: { route: 'Nutrition' }
        };
    }
    if (!isInTribe && (stats.streak || 0) > 3) {
        return {
            text: isFemale
                ? `The journey is better with company. Join a Tribe to move with others who are headed in the same direction.`
                : `Iron sharpens iron. Join a Tribe and surround yourself with others seeking the same summit.`,
            icon: "account-group",
            action: { route: 'Tribes' }
        };
    }
    return {
        text: isFemale
            ? `You have found your rhythm, ${personality}. Stay on this path. Consistency is the only shortcut that exists.`
            : `You are locked in, ${personality}. Maintain this bearing. Momentum is your greatest asset right now.`,
        icon: "navigation",
        action: { route: 'Progress' }
    };
}

interface CoachInsightCardProps {
    userMemory: any;
    stats: any;
    isInTribe?: boolean;
    preferredTime?: string | null;
    hasGaps?: boolean;
    gender?: string | 'male' | 'female';
    onPress?: (action: { route: string; params?: any }) => void;
    isLoading?: boolean;
}

export const CoachInsightCard: React.FC<CoachInsightCardProps> = ({ userMemory, stats, isInTribe, preferredTime, hasGaps, gender, onPress, isLoading = false }) => {
    const { theme } = useTheme();
    const [isVisible, setIsVisible] = useState(true);
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const shimmerValue = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        if (isLoading) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(shimmerValue, {
                        toValue: 0.7,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(shimmerValue, {
                        toValue: 0.3,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        }
    }, [isLoading]);

    useEffect(() => {
        // Auto-dismiss after 10 seconds only if NOT loading
        if (!isLoading) {
            const timer = setTimeout(() => {
                handleDismiss();
            }, 10000);
            return () => clearTimeout(timer);
        }
    }, [isLoading]);

    const handleDismiss = () => {
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
        }).start(() => setIsVisible(false));
    };

    const insight = useMemo(
        () => getCoachInsight({ userMemory, stats, isInTribe, preferredTime, hasGaps, gender }),
        [userMemory, stats, isInTribe, preferredTime, hasGaps, gender]
    );

    if (!isVisible) return null;

    if (isLoading) {
        return (
            <View style={styles.container}>
                <View style={[styles.gradient, { borderColor: theme.border, backgroundColor: theme.backgroundCard, opacity: 0.8 }]}>
                    <Animated.View style={[styles.iconContainer, { backgroundColor: theme.border, opacity: shimmerValue }]} />
                    <View style={styles.content}>
                        <Animated.View style={{ width: 80, height: 10, borderRadius: 5, backgroundColor: theme.border, opacity: shimmerValue, marginBottom: 8 }} />
                        <Animated.View style={{ width: '90%', height: 14, borderRadius: 7, backgroundColor: theme.border, opacity: shimmerValue, marginBottom: 4 }} />
                        <Animated.View style={{ width: '70%', height: 14, borderRadius: 7, backgroundColor: theme.border, opacity: shimmerValue }} />
                    </View>
                </View>
            </View>
        );
    }

    return (
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => onPress && onPress(insight.action)}
            >
                <LinearGradient
                    colors={['rgba(42, 75, 42, 0.15)', 'rgba(42, 75, 42, 0.05)']}
                    style={[styles.gradient, { borderColor: theme.primary + '30' }]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={[styles.iconContainer, { backgroundColor: theme.primary + '20' }]}>
                        <MaterialCommunityIcons name={insight.icon as any} size={20} color={theme.primary} />
                    </View>
                    <View style={styles.content}>
                        <Text style={[styles.title, { color: theme.textSecondary }]}>COACH'S INSIGHT</Text>
                        <Text style={[styles.text, { color: theme.text }]}>{insight.text}</Text>
                    </View>

                    <View style={styles.rightActions}>
                        <TouchableOpacity
                            onPress={handleDismiss}
                            style={styles.closeButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <MaterialCommunityIcons name="close" size={18} color={theme.textMuted} />
                        </TouchableOpacity>
                        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textMuted} />
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 12,
    },
    gradient: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        paddingRight: 10, // Adjusted for close button
        borderRadius: 20,
        borderWidth: 1,
    },
    iconContainer: {
        width: 40,
        height: 41,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    content: {
        flex: 1,
    },
    rightActions: {
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '100%',
        paddingVertical: 2,
    },
    closeButton: {
        marginBottom: 8,
    },
    title: {
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1.2,
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    text: {
        fontSize: 14,
        fontWeight: '600',
        lineHeight: 20,
    }
});
