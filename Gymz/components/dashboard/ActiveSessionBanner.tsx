import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { designSystem } from '../../theme/designSystem';
import { useTheme } from '../../hooks/useTheme';

interface ActiveSessionBannerProps {
    checkInTime: string;
    duration: number; // in minutes
    streak: number;
    isCheckingOut: boolean;
    onCheckOut: () => void;
    onPress: () => void;
}

export const ActiveSessionBanner: React.FC<ActiveSessionBannerProps> = ({
    checkInTime,
    duration,
    streak,
    isCheckingOut,
    onCheckOut,
    onPress
}) => {
    const { theme, isDark } = useTheme();
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Breathing pulse effect
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.1,
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
    }, []);

    const BannerContent = (
        <View style={styles.innerWrapper}>
            {/* Background Glow */}
            <View style={[styles.glow, { backgroundColor: theme.primary }]} />

            <View style={styles.card}>
                {/* Header Section */}
                <View style={styles.header}>
                    <Animated.View style={[styles.iconBox, { transform: [{ scale: pulseAnim }], borderColor: theme.primary + '40', backgroundColor: theme.backgroundInput }]}>
                        <MaterialCommunityIcons name="timer-outline" size={28} color={theme.primary} />
                        <View style={[styles.pulseDot, { backgroundColor: theme.primary }]} />
                    </Animated.View>

                    <View style={styles.headerTitle}>
                        <Text style={[styles.title, { color: theme.text }]}>Active Session</Text>
                        <View style={styles.statusRow}>
                            <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>In Progress • Live Tracking</Text>
                        </View>
                    </View>

                    {streak > 0 && (
                        <View style={[styles.streakBox, { backgroundColor: '#F59E0B20' }]}>
                            <MaterialCommunityIcons name="fire" size={14} color="#F59E0B" />
                            <Text style={styles.streakVal}>{streak}</Text>
                        </View>
                    )}
                </View>

                {/* Stats Grid */}
                <View style={[styles.statsGrid, { backgroundColor: theme.backgroundInput }]}>
                    <View style={styles.statCell}>
                        <Text style={[styles.statLabel, { color: theme.textMuted }]}>STARTED</Text>
                        <Text style={[styles.statValue, { color: theme.text }]}>
                            {format(new Date(checkInTime), 'h:mm a')}
                        </Text>
                    </View>
                    <View style={[styles.vDivider, { backgroundColor: theme.border }]} />
                    <View style={styles.statCell}>
                        <Text style={[styles.statLabel, { color: theme.textMuted }]}>DURATION</Text>
                        <Text style={[styles.statValue, { color: theme.text }]}>{duration} <Text style={styles.minUnit}>min</Text></Text>
                    </View>
                </View>

                {/* Action Row */}
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={styles.primaryAction}
                        activeOpacity={0.8}
                        onPress={onPress}
                    >
                        <Text style={[styles.actionLink, { color: theme.primary }]}>View Details</Text>
                        <MaterialCommunityIcons name="chevron-right" size={18} color={theme.primary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.checkoutBtn, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]}
                        onPress={onCheckOut}
                        disabled={isCheckingOut}
                    >
                        {isCheckingOut ? (
                            <ActivityIndicator size="small" color="#EF4444" />
                        ) : (
                            <>
                                <MaterialCommunityIcons name="logout" size={16} color="#EF4444" />
                                <Text style={styles.checkoutText}>Check Out</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}>
            {BannerContent}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        alignSelf: 'center',
        marginBottom: 32,
        borderRadius: 32,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    blurWrapper: {
        width: '100%',
    },
    innerWrapper: {
        width: '100%',
        position: 'relative',
    },
    glow: {
        position: 'absolute',
        top: -40,
        right: -40,
        width: 120,
        height: 120,
        borderRadius: 60,
        opacity: 0.08,
    },
    card: {
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    iconBox: {
        width: 52,
        height: 52,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    pulseDot: {
        position: 'absolute',
        top: 14,
        right: 14,
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    headerTitle: {
        flex: 1,
        marginLeft: 15,
    },
    title: {
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    subtitle: {
        fontSize: 12,
        fontWeight: '600',
    },
    streakBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
    },
    streakVal: {
        fontSize: 13,
        fontWeight: '900',
        color: '#F59E0B',
    },
    statsGrid: {
        flexDirection: 'row',
        borderRadius: 20,
        padding: 18,
        marginBottom: 20,
    },
    statCell: {
        flex: 1,
        alignItems: 'center',
    },
    vDivider: {
        width: 1,
        height: 25,
        alignSelf: 'center',
    },
    statLabel: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    statValue: {
        fontSize: 18,
        fontWeight: '900',
    },
    minUnit: {
        fontSize: 12,
        opacity: 0.6,
        fontWeight: '700',
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    primaryAction: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionLink: {
        fontSize: 14,
        fontWeight: '800',
    },
    checkoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 14,
    },
    checkoutText: {
        color: '#EF4444',
        fontSize: 14,
        fontWeight: '800',
    },
});
