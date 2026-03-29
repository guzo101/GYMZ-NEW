import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ScrollView } from 'react-native';
import { designSystem } from '../../theme/designSystem';
import { useTheme } from '../../hooks/useTheme';
import { DASHBOARD_LAYOUT } from './dashboardLayoutConstants';

export const DashboardSkeleton = () => {
    const { theme } = useTheme();
    const shimmerValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(shimmerValue, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(shimmerValue, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    const opacity = shimmerValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    return (
        <ScrollView 
            style={[styles.container, { backgroundColor: theme.background }]}
            contentContainerStyle={{
                paddingHorizontal: DASHBOARD_LAYOUT.contentPaddingHorizontal,
                paddingTop: DASHBOARD_LAYOUT.contentPaddingTop + 60, // Account for header
                paddingBottom: DASHBOARD_LAYOUT.contentPaddingBottom,
            }}
            showsVerticalScrollIndicator={false}
        >
            {/* Header Skeleton */}
            <View style={styles.headerSkeleton}>
                <Animated.View style={[styles.avatarSkeleton, { backgroundColor: theme.border, opacity }]} />
                <View style={styles.headerTextCol}>
                    <Animated.View style={[styles.titleSkeleton, { backgroundColor: theme.border, opacity }]} />
                    <Animated.View style={[styles.subtitleSkeleton, { backgroundColor: theme.border, opacity }]} />
                </View>
            </View>

            {/* Week Row Skeleton */}
            <View style={[styles.weekRowSkeleton, { marginBottom: DASHBOARD_LAYOUT.daysToNextBlockSpacing }]}>
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <View key={i} style={styles.daySkeletonItem}>
                        <Animated.View style={[styles.dayLabelSkeleton, { backgroundColor: theme.border, opacity }]} />
                        <Animated.View style={[styles.dayCircleSkeleton, { backgroundColor: theme.border, opacity }]} />
                    </View>
                ))}
            </View>

            {/* Coach Insight Skeleton */}
            <Animated.View style={[styles.cardSkeleton, { height: 100, backgroundColor: theme.border, opacity, marginBottom: DASHBOARD_LAYOUT.sectionSpacing }]} />

            {/* Daily Pulse Skeleton */}
            <Animated.View style={[styles.cardSkeleton, { height: 360, backgroundColor: theme.border, opacity, marginBottom: DASHBOARD_LAYOUT.sectionSpacing }]} />

            {/* Other Cards */}
            <Animated.View style={[styles.cardSkeleton, { height: 120, backgroundColor: theme.border, opacity, marginBottom: DASHBOARD_LAYOUT.sectionSpacing }]} />
            <Animated.View style={[styles.cardSkeleton, { height: 200, backgroundColor: theme.border, opacity, marginBottom: DASHBOARD_LAYOUT.sectionSpacing }]} />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerSkeleton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 30,
    },
    avatarSkeleton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 15,
    },
    headerTextCol: {
        flex: 1,
        gap: 8,
    },
    titleSkeleton: {
        width: '60%',
        height: 24,
        borderRadius: 6,
    },
    subtitleSkeleton: {
        width: '40%',
        height: 16,
        borderRadius: 4,
    },
    weekRowSkeleton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    daySkeletonItem: {
        alignItems: 'center',
        gap: 8,
    },
    dayLabelSkeleton: {
        width: 20,
        height: 12,
        borderRadius: 4,
    },
    dayCircleSkeleton: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    cardSkeleton: {
        width: '100%',
        borderRadius: 24,
    },
});
