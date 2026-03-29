import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../hooks/useTheme';
import { designSystem } from '../../theme/designSystem';

interface WeekOverWeekCardProps {
    thisWeek: {
        avgCalories: number;
        avgProtein: number;
        daysLogged: number;
        proteinHitRate: number;
    };
    lastWeek: {
        avgCalories: number;
        avgProtein: number;
        daysLogged: number;
        proteinHitRate: number;
    };
    weightDelta: number | null;
    isImproving: boolean;
    onPress?: () => void;
}

export const WeekOverWeekCard: React.FC<WeekOverWeekCardProps> = ({
    thisWeek,
    lastWeek,
    weightDelta,
    isImproving,
    onPress,
}) => {
    const { theme, isDark } = useTheme();

    // Don't show if no data from last week
    if (lastWeek.daysLogged === 0) {
        return null;
    }

    const caloriesDelta = thisWeek.avgCalories - lastWeek.avgCalories;
    const proteinDelta = thisWeek.avgProtein - lastWeek.avgProtein;
    const proteinRateDelta = thisWeek.proteinHitRate - lastWeek.proteinHitRate;

    const getDeltaColor = (delta: number, inverted = false) => {
        if (delta === 0) return theme.textMuted;
        const positive = inverted ? delta < 0 : delta > 0;
        return positive ? '#10B981' : '#EF4444';
    };

    const getDeltaIcon = (delta: number, inverted = false): string => {
        if (delta === 0) return 'minus';
        const positive = inverted ? delta < 0 : delta > 0;
        return positive ? 'trending-up' : 'trending-down';
    };

    const formatDelta = (delta: number, suffix = '') => {
        if (delta === 0) return '–';
        const sign = delta > 0 ? '+' : '';
        return `${sign}${delta}${suffix}`;
    };

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={onPress}
            style={styles.container}
        >
            <LinearGradient
                colors={isImproving
                    ? ['rgba(16, 185, 129, 0.15)', 'rgba(16, 185, 129, 0.05)']
                    : ['rgba(239, 68, 68, 0.15)', 'rgba(239, 68, 68, 0.05)']}
                style={[styles.gradient, {
                    borderColor: isImproving ? '#10B98130' : '#EF444430',
                    backgroundColor: theme.backgroundCard
                }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={[styles.iconContainer, {
                        backgroundColor: isImproving ? '#10B98120' : '#EF444420'
                    }]}>
                        <MaterialCommunityIcons
                            name={isImproving ? "chart-line" : "chart-line-variant"}
                            size={18}
                            color={isImproving ? '#10B981' : '#EF4444'}
                        />
                    </View>
                    <View style={styles.headerText}>
                        <Text style={[styles.title, { color: theme.textSecondary }]}>
                            THIS WEEK VS LAST
                        </Text>
                        <Text style={[styles.subtitle, { color: theme.text }]}>
                            {isImproving ? "You're on track! 🔥" : "Let's level up this week"}
                        </Text>
                    </View>
                    <MaterialCommunityIcons
                        name="chevron-right"
                        size={20}
                        color={theme.textMuted}
                    />
                </View>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    {/* Protein Hit Rate - Most Important */}
                    <View style={styles.statItem}>
                        <Text style={[styles.statLabel, { color: theme.textMuted }]}>
                            Protein Hits
                        </Text>
                        <View style={styles.statValueRow}>
                            <Text style={[styles.statValue, { color: theme.text }]}>
                                {thisWeek.proteinHitRate}%
                            </Text>
                            <View style={styles.deltaContainer}>
                                <MaterialCommunityIcons
                                    name={getDeltaIcon(proteinRateDelta) as any}
                                    size={14}
                                    color={getDeltaColor(proteinRateDelta)}
                                />
                                <Text style={[styles.deltaText, { color: getDeltaColor(proteinRateDelta) }]}>
                                    {formatDelta(proteinRateDelta, '%')}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Avg Protein */}
                    <View style={styles.statItem}>
                        <Text style={[styles.statLabel, { color: theme.textMuted }]}>
                            Avg Protein
                        </Text>
                        <View style={styles.statValueRow}>
                            <Text style={[styles.statValue, { color: theme.text }]}>
                                {thisWeek.avgProtein}g
                            </Text>
                            <View style={styles.deltaContainer}>
                                <MaterialCommunityIcons
                                    name={getDeltaIcon(proteinDelta) as any}
                                    size={14}
                                    color={getDeltaColor(proteinDelta)}
                                />
                                <Text style={[styles.deltaText, { color: getDeltaColor(proteinDelta) }]}>
                                    {formatDelta(proteinDelta, 'g')}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Days Logged */}
                    <View style={styles.statItem}>
                        <Text style={[styles.statLabel, { color: theme.textMuted }]}>
                            Days Logged
                        </Text>
                        <View style={styles.statValueRow}>
                            <Text style={[styles.statValue, { color: theme.text }]}>
                                {thisWeek.daysLogged}
                            </Text>
                            <Text style={[styles.vsText, { color: theme.textSecondary }]}>
                                vs {lastWeek.daysLogged}
                            </Text>
                        </View>
                    </View>

                    {/* Weight Delta - Only if available */}
                    {weightDelta !== null && (
                        <View style={styles.statItem}>
                            <Text style={[styles.statLabel, { color: theme.textMuted }]}>
                                Weight
                            </Text>
                            <View style={styles.statValueRow}>
                                <MaterialCommunityIcons
                                    name={getDeltaIcon(weightDelta, true) as any}
                                    size={16}
                                    color={getDeltaColor(weightDelta, true)}
                                />
                                <Text style={[styles.statValue, {
                                    color: getDeltaColor(weightDelta, true)
                                }]}>
                                    {formatDelta(weightDelta, 'kg')}
                                </Text>
                            </View>
                        </View>
                    )}
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    gradient: {
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerText: {
        flex: 1,
    },
    title: {
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1.2,
        marginBottom: 2,
        textTransform: 'uppercase',
    },
    subtitle: {
        fontSize: 14,
        fontWeight: '700',
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    statItem: {
        width: '48%',
        marginBottom: 12,
    },
    statLabel: {
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statValueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statValue: {
        fontSize: 18,
        fontWeight: '900',
    },
    deltaContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    deltaText: {
        fontSize: 12,
        fontWeight: '700',
    },
    vsText: {
        fontSize: 12,
        fontWeight: '600',
    },
});
