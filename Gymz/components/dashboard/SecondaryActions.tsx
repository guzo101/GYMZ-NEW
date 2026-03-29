import React from 'react';
import { View, StyleSheet, Text, ScrollView, Alert } from 'react-native';
import { ActionCard } from '../ActionCard';
import { designSystem } from '../../theme/designSystem';
import { useTheme } from '../../hooks/useTheme';

import { useAuth } from '../../hooks/useAuth';

interface SecondaryActionsProps {
    navigation: any;
    hasProactiveMessage?: boolean;
    onShowSuggestions?: () => void;
    onPress?: () => void;
    hasActiveSession?: boolean;
    sessionDuration?: number;
}

export const SecondaryActions: React.FC<SecondaryActionsProps> = ({
    navigation,
    hasProactiveMessage,
    onShowSuggestions,
    onPress,
    hasActiveSession,
    sessionDuration
}) => {
    const { theme } = useTheme();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    return (
        <View style={styles.container}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Discover</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                style={styles.scrollView}
            >
                <View style={styles.cardWrapper}>
                    <ActionCard
                        icon="timer"
                        title={hasActiveSession ? "Active Timer" : "Gym Timer"}
                        subtitle={hasActiveSession ? (sessionDuration ? `${sessionDuration} min counting` : 'Live session') : 'Check in status'}
                        iconColor={theme.primary}
                        backgroundColor={`${theme.primary}20`}
                        onPress={() => navigation.navigate('Attendance')}
                    />
                </View>

                <View style={styles.cardWrapper}>
                    <ActionCard
                        icon="food"
                        title="What Should I Eat?"
                        subtitle="Prescriptive meals"
                        iconColor="#10B981"
                        backgroundColor="rgba(16, 185, 129, 0.15)"
                        onPress={onShowSuggestions || (() => navigation.navigate('Nutrition'))}
                    />
                </View>

                <View style={styles.cardWrapper}>
                    {hasProactiveMessage && (
                        <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                            <Text style={styles.badgeText}>1</Text>
                        </View>
                    )}
                    <ActionCard
                        icon="robot"
                        title="AI Coach"
                        subtitle="Chat with AI"
                        iconColor={theme.primary}
                        backgroundColor={`${theme.primary}15`}
                        onPress={onPress || (() => navigation.navigate('AIChat'))}
                    />
                </View>

                <View style={styles.cardWrapper}>
                    <ActionCard
                        icon="calendar-clock"
                        title="Schedule"
                        subtitle="Book classes"
                        iconColor="#2A4B2A"
                        backgroundColor="rgba(42, 75, 42, 0.15)"
                        onPress={() => navigation.navigate('GymCalendar')}
                    />
                </View>

                {isAdmin && (
                    <View style={styles.cardWrapper}>
                        <ActionCard
                            icon="account-group"
                            title="Tribes"
                            subtitle="Find your crew"
                            iconColor="#10B981"
                            backgroundColor="rgba(16, 185, 129, 0.15)"
                            onPress={() => navigation.navigate('Tribes')}
                        />
                    </View>
                )}

                <View style={styles.cardWrapper}>
                    <ActionCard
                        icon="message-bulleted"
                        title={isAdmin ? "Community" : "Future Release"}
                        subtitle={isAdmin ? "Chat tribe" : "Community chat coming soon"}
                        iconColor="#FBBF24"
                        backgroundColor="rgba(251, 191, 36, 0.15)"
                        onPress={() => {
                            if (!isAdmin) {
                                Alert.alert('Future Release', 'Community chat will be available in a future release.');
                                return;
                            }
                            navigation.navigate('CommunityChat');
                        }}
                    />
                </View>

                {isAdmin && (
                    <>
                        <View style={styles.cardWrapper}>
                            <ActionCard
                                icon="trophy"
                                title="Awards"
                                subtitle="View Achievements"
                                iconColor="#FB923C"
                                backgroundColor="rgba(251, 146, 60, 0.15)"
                                onPress={() => navigation.navigate('Achievements')}
                            />
                        </View>
                        <View style={styles.cardWrapper}>
                            <ActionCard
                                icon="crown"
                                title="Leaderboard"
                                subtitle="Top Rank"
                                iconColor="#22D3EE"
                                backgroundColor="rgba(34, 211, 238, 0.15)"
                                onPress={() => navigation.navigate('Leaderboard')}
                            />
                        </View>
                        <View style={styles.cardWrapper}>
                            <ActionCard
                                icon="shield-check"
                                title="Admin Console"
                                subtitle="GMS Management"
                                iconColor="#EF4444"
                                backgroundColor="rgba(239, 68, 68, 0.15)"
                                onPress={() => navigation.navigate('AdminConsole')}
                            />
                        </View>
                    </>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: designSystem.spacing.xl,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: designSystem.spacing.md,
        paddingHorizontal: 4,
    },
    scrollView: {
        marginHorizontal: -24, // Use direct value to ensure edge-to-edge
    },
    scrollContent: {
        paddingTop: 12, // Added padding to accommodate badge offset (-8)
        paddingHorizontal: 24,
        gap: 20, // Increased gap for better arrangement
        paddingBottom: 20, // More room for shadows
    },
    cardWrapper: {
        width: 175,
        flexShrink: 0,
        flexGrow: 0,
        position: 'relative',
    },
    badge: {
        position: 'absolute',
        top: -8,
        right: -8,
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        ...designSystem.shadows.md,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
});
