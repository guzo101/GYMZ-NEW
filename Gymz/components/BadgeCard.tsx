import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

interface BadgeCardProps {
    badgeName: string;
    badgeDescription: string;
    badgeIcon: string;
    tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
    gradientColors: string[];
    isUnlocked: boolean;
    currentProgress?: number;
    requiredProgress?: number;
    unlockedAt?: string;
    onPress?: () => void;
}

export function BadgeCard({
    badgeName,
    badgeDescription,
    badgeIcon,
    tier,
    gradientColors,
    isUnlocked,
    currentProgress,
    requiredProgress,
    unlockedAt,
    onPress,
}: BadgeCardProps) {
    const { theme } = useTheme();

    const getTierColor = () => {
        switch (tier) {
            case 'bronze': return '#CD7F32';
            case 'silver': return '#C0C0C0';
            case 'gold': return '#FFD700';
            case 'platinum': return '#E5E4E2';
            case 'diamond': return '#B9F2FF';
            default: return '#C0C0C0';
        }
    };

    const progress = currentProgress && requiredProgress
        ? Math.min((currentProgress / requiredProgress) * 100, 100)
        : 0;

    return (
        <TouchableOpacity
            style={[styles.container, { backgroundColor: theme.backgroundCard }]}
            onPress={onPress}
            activeOpacity={0.7}
            disabled={!onPress}
        >
            <LinearGradient
                colors={isUnlocked ? (gradientColors as unknown as [string, string]) : (['#4B5563', '#6B7280'] as const as [string, string])}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconGradient}
            >
                <MaterialCommunityIcons
                    name={badgeIcon as any}
                    size={36}
                    color="#FFF"
                    style={!isUnlocked && styles.lockedIcon}
                />
            </LinearGradient>

            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={[styles.badgeName, { color: theme.text }]} numberOfLines={1}>
                        {badgeName}
                    </Text>
                    <View style={[styles.tierBadge, { backgroundColor: getTierColor() + '20' }]}>
                        <Text style={[styles.tierText, { color: getTierColor() }]}>
                            {tier.toUpperCase()}
                        </Text>
                    </View>
                </View>

                <Text style={[styles.description, { color: theme.textSecondary }]} numberOfLines={2}>
                    {badgeDescription}
                </Text>

                {!isUnlocked && currentProgress !== undefined && requiredProgress !== undefined && (
                    <View style={styles.progressContainer}>
                        <View style={[styles.progressBarBg, { backgroundColor: theme.border }]}>
                            <View
                                style={[
                                    styles.progressBarFill,
                                    {
                                        width: `${progress}%`,
                                        backgroundColor: gradientColors[0]
                                    }
                                ]}
                            />
                        </View>
                        <Text style={[styles.progressText, { color: theme.textMuted }]}>
                            {currentProgress} / {requiredProgress}
                        </Text>
                    </View>
                )}

                {isUnlocked && unlockedAt && (
                    <Text style={[styles.unlockedText, { color: theme.primary }]}>
                        ✓ Unlocked {new Date(unlockedAt).toLocaleDateString()}
                    </Text>
                )}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        borderRadius: 20,
        padding: 16,
        gap: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        marginBottom: 12,
    },
    iconGradient: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    lockedIcon: {
        opacity: 0.4,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        gap: 6,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    badgeName: {
        fontSize: 16,
        fontWeight: '700',
        flex: 1,
    },
    tierBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    tierText: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    description: {
        fontSize: 13,
        fontWeight: '500',
        lineHeight: 18,
    },
    progressContainer: {
        marginTop: 4,
        gap: 4,
    },
    progressBarBg: {
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
        opacity: 0.3,
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    progressText: {
        fontSize: 11,
        fontWeight: '600',
    },
    unlockedText: {
        fontSize: 12,
        fontWeight: '700',
        marginTop: 2,
    },
});
