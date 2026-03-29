import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, RefreshControl, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { designSystem } from '../theme/designSystem';
import { ProgressRing } from '../components/ProgressRing';
import { useTheme } from '../hooks/useTheme';
import { ScreenHeader } from '../components/ScreenHeader';
import { DynamicBackground } from '../components/dashboard/DynamicBackground';
import { useAuth } from '../hooks/useAuth';
import { achievementService, TribeAchievement } from '../services/achievementService';
import { leaderboardService, LeaderboardUser } from '../services/leaderboardService';

const { width } = Dimensions.get('window');

const TABS = ['Overview', 'Badges', 'History'];

export default function AchievementsScreen({ navigation }: any) {
    const { user } = useAuth();
    const { theme, isDark } = useTheme();
    const [activeTab, setActiveTab] = useState('Overview');
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [achievements, setAchievements] = useState<any[]>([]);
    const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);

    const fetchData = async () => {
        if (!user?.id) return;
        try {
            // Using a default tribeId for global achievements if not in a specific tribe
            const dummyTribeId = 'global';
            const [achData, lbData] = await Promise.all([
                achievementService.getUserAchievements(user.id, dummyTribeId),
                leaderboardService.fetchGlobalLeaderboard(5)
            ]);
            setAchievements(achData);
            setLeaderboard(lbData);
        } catch (error) {
            console.error('Error fetching achievements data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    React.useEffect(() => {
        fetchData();
    }, [user?.id]);

    const onRefresh = React.useCallback(() => {
        setRefreshing(true);
        fetchData();
    }, [user?.id]);

    const renderHeaderTabs = () => (
        <View style={[styles.tabContainer, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.4)' : 'rgba(255, 255, 255, 0.5)' }]}>
            {TABS.map((tab) => (
                <TouchableOpacity
                    key={tab}
                    onPress={() => setActiveTab(tab)}
                    style={[
                        styles.tab,
                        activeTab === tab && { backgroundColor: theme.backgroundInput }
                    ]}
                >
                    <Text style={[
                        styles.tabText,
                        { color: theme.textSecondary },
                        activeTab === tab && { color: theme.text, fontWeight: 'bold' }
                    ]}>
                        {tab}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    const renderStreakCard = () => (
        <LinearGradient
            colors={designSystem.colors.gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.streakCard, { shadowColor: theme.primary }]}
        >
            <View style={styles.streakContent}>
                <View>
                    <Text style={styles.streakLabel}>Current Streak</Text>
                    <View style={styles.streakCountContainer}>
                        <MaterialCommunityIcons name="fire" size={32} color={designSystem.colors.accent.orange} />
                        <Text style={styles.streakCount}>15 Days</Text>
                    </View>
                    <View style={styles.longestStreakBadge}>
                        <Text style={styles.longestStreakText}>Longest: 32 Days</Text>
                    </View>
                </View>

                {/* Simple Bar Chart Visualization */}
                <View style={styles.chartContainer}>
                    {[0.4, 0.6, 0.3, 0.8, 0.5, 0.9].map((height, index) => (
                        <View key={index} style={styles.chartBarContainer}>
                            <View style={[styles.chartBar, { height: height * 50, opacity: index === 5 ? 1 : 0.5 }]} />
                        </View>
                    ))}
                </View>
            </View>
        </LinearGradient>
    );

    const renderMilestones = () => {
        const milestones = achievements.filter(a => !a.isUnlocked).slice(0, 3);
        return (
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Next Milestones</Text>
                    <TouchableOpacity>
                        <Text style={[styles.seeAllText, { color: theme.primary }]}>View All →</Text>
                    </TouchableOpacity>
                </View>

                {milestones.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.milestonesScroll}>
                        {milestones.map((item, index) => (
                            <View key={index} style={[styles.milestoneCard, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.8)', borderColor: theme.border }]}>
                                <View style={styles.milestoneRingContainer}>
                                    <ProgressRing
                                        size={66}
                                        strokeWidth={6}
                                        progress={30 + (index * 20)} // Mock progress for locked ones
                                        color={index % 2 === 0 ? theme.primary : designSystem.colors.accent.cyan}
                                        backgroundColor={theme.backgroundInput}
                                        showLabel={false}
                                    />
                                    <View style={styles.milestoneIconOverlay}>
                                        <MaterialCommunityIcons name={item.icon || 'star'} size={24} color={theme.primary} />
                                    </View>
                                </View>
                                <Text style={[styles.milestoneTitle, { color: theme.text }]}>{item.title}</Text>
                                <Text style={[styles.milestoneSubtitle, { color: theme.textSecondary }]}>{item.description}</Text>
                                <View style={[styles.inProgressBadge, { backgroundColor: theme.backgroundInput }]}>
                                    <Text style={[styles.inProgressText, { color: theme.textSecondary }]}>In Progress</Text>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                ) : (
                    <View style={[styles.milestoneCard, { width: '100%', padding: 20 }]}>
                        <Text style={{ color: theme.text }}>Great job! You've reached all current milestones.</Text>
                    </View>
                )}
            </View>
        );
    };

    const renderBadges = () => {
        const unlocked = achievements.filter(a => a.isUnlocked);
        return (
            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Unlocked Badges</Text>
                <View style={styles.badgesGrid}>
                    {unlocked.map((badge, index) => (
                        <View key={index} style={[styles.badgeCard, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.8)', borderColor: theme.border }]}>
                            <View style={[styles.badgeIconBg, { backgroundColor: `${theme.primary}20` }]}>
                                <MaterialCommunityIcons
                                    name={(badge.icon || 'medal') as any}
                                    size={24}
                                    color={theme.primary}
                                />
                            </View>
                            <Text style={[styles.badgeName, { color: theme.text }]}>{badge.title}</Text>
                            <Text style={[styles.badgeStatus, { color: theme.textSecondary }]}>Unlocked</Text>
                        </View>
                    ))}
                    {unlocked.length === 0 && (
                        <Text style={{ color: theme.textSecondary, marginLeft: 4 }}>No badges unlocked yet. Keep training!</Text>
                    )}
                </View>
            </View>
        );
    };

    const renderLeaderboard = () => {
        const topThree = leaderboard.slice(0, 3);
        const others = leaderboard.slice(3);

        return (
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Leaderboard</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Leaderboard')}>
                        <Text style={[styles.seeAllText, { color: theme.primary }]}>View Full →</Text>
                    </TouchableOpacity>
                </View>

                {topThree.length >= 3 && (
                    <View style={styles.podiumContainer}>
                        {/* Second Place */}
                        <View style={[styles.podiumItem, { marginTop: 24 }]}>
                            <View style={styles.avatarContainer}>
                                <LinearGradient colors={['#2A4B2A', '#2A4B2A']} style={styles.avatarRing}>
                                    <Image source={{ uri: topThree[1].avatarUrl }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                                </LinearGradient>
                                <View style={[styles.rankBadge2, { borderColor: theme.background }]}>
                                    <Text style={styles.rankText}>2</Text>
                                </View>
                            </View>
                            <Text style={[styles.podiumName, { color: theme.text }]} numberOfLines={1}>{topThree[1].name}</Text>
                            <Text style={[styles.podiumPoints, { color: theme.textSecondary }]}>{topThree[1].totalPoints} PTS</Text>
                        </View>

                        {/* First Place */}
                        <View style={styles.podiumItem}>
                            <MaterialCommunityIcons name="crown" size={24} color="#FBBF24" style={{ marginBottom: 4 }} />
                            <View style={styles.avatarContainer}>
                                <LinearGradient colors={['#FBBF24', '#F59E0B']} style={[styles.avatarRing, { width: 56, height: 56 }]}>
                                    <Image source={{ uri: topThree[0].avatarUrl }} style={{ width: 52, height: 52, borderRadius: 26 }} />
                                </LinearGradient>
                                <View style={[styles.rankBadge1, { borderColor: theme.background }]}>
                                    <Text style={styles.rankText}>1</Text>
                                </View>
                            </View>
                            <Text style={[styles.podiumName, { color: theme.text }]} numberOfLines={1}>{topThree[0].name}</Text>
                            <Text style={[styles.podiumPoints, { color: theme.textSecondary }]}>{topThree[0].totalPoints} PTS</Text>
                        </View>

                        {/* Third Place */}
                        <View style={[styles.podiumItem, { marginTop: 40 }]}>
                            <View style={styles.avatarContainer}>
                                <LinearGradient colors={['#FBD85D', '#F1C93B']} style={styles.avatarRing}>
                                    <Image source={{ uri: topThree[2].avatarUrl }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                                </LinearGradient>
                                <View style={[styles.rankBadge3, { borderColor: theme.background }]}>
                                    <Text style={styles.rankText}>3</Text>
                                </View>
                            </View>
                            <Text style={[styles.podiumName, { color: theme.text }]} numberOfLines={1}>{topThree[2].name}</Text>
                            <Text style={[styles.podiumPoints, { color: theme.textSecondary }]}>{topThree[2].totalPoints} PTS</Text>
                        </View>
                    </View>
                )}

                <View style={[styles.leaderboardList, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.8)', borderColor: theme.border, borderWidth: 1 }]}>
                    {others.map((item, idx) => (
                        <View key={item.userId} style={[styles.leaderboardRow, { borderBottomColor: theme.border }]}>
                            <Text style={[styles.listRank, { color: theme.textSecondary }]}>{idx + 4}</Text>
                            <Image source={{ uri: item.avatarUrl }} style={styles.listAvatar} />
                            <Text style={[styles.listName, { color: theme.text }]}>{item.name}</Text>
                            <Text style={[styles.listPoints, { color: theme.primary }]}>{item.totalPoints.toLocaleString()} PTS</Text>
                        </View>
                    ))}
                    {leaderboard.length === 0 && (
                        <ActivityIndicator color={theme.primary} />
                    )}
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <DynamicBackground rotationType="fixed" fixedIndex={3} />
            <ScreenHeader title="Achievements" />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
                }
            >
                {renderHeaderTabs()}
                <View style={{ height: 20 }} />

                {activeTab === 'Overview' && (
                    <>
                        {renderStreakCard()}
                        {renderMilestones()}
                        {renderBadges()}
                        {renderLeaderboard()}
                    </>
                )}
                {activeTab === 'Badges' && (
                    <View>
                        {/* Badges Stats */}
                        <View style={styles.badgesStatsContainer}>
                            <View style={[styles.badgesStatCard, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}>
                                <Text style={[styles.badgesStatValue, { color: theme.text }]}>8</Text>
                                <Text style={[styles.badgesStatLabel, { color: theme.textSecondary }]}>Unlocked</Text>
                            </View>
                            <View style={[styles.badgesStatCard, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}>
                                <Text style={[styles.badgesStatValue, { color: theme.text }]}>12</Text>
                                <Text style={[styles.badgesStatLabel, { color: theme.textSecondary }]}>Total Badges</Text>
                            </View>
                            <View style={[styles.badgesStatCard, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}>
                                <Text style={[styles.badgesStatValue, { color: theme.text }]}>67%</Text>
                                <Text style={[styles.badgesStatLabel, { color: theme.textSecondary }]}>Progress</Text>
                            </View>
                        </View>

                        {/* Workout Badges */}
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>Workout Achievements</Text>
                            <View style={styles.badgesGrid}>
                                {[
                                    { name: 'First Step', icon: 'medal', color: '#F59E0B', unlocked: true },
                                    { name: 'Early Bird', icon: 'weather-sunny', color: '#2A4B2A', unlocked: true },
                                    { name: 'Night Owl', icon: 'weather-night', color: '#6B7280', unlocked: false },
                                    { name: 'Cardio King', icon: 'heart-pulse', color: '#EF4444', unlocked: true },
                                    { name: 'Iron Lifter', icon: 'dumbbell', color: '#6B7280', unlocked: false },
                                    { name: 'Marathon', icon: 'run', color: '#10B981', unlocked: false },
                                ].map((badge, index) => (
                                    <View key={index} style={[styles.badgeCard, { backgroundColor: theme.backgroundCard, borderColor: theme.border }, !badge.unlocked && styles.lockedBadge]}>
                                        <View style={[styles.badgeIconBg, { backgroundColor: badge.unlocked ? `${badge.color}20` : theme.backgroundInput }]}>
                                            <MaterialCommunityIcons
                                                name={(badge.unlocked ? badge.icon : 'lock') as any}
                                                size={24}
                                                color={badge.unlocked ? badge.color : theme.textMuted}
                                            />
                                        </View>
                                        <Text style={[styles.badgeName, { color: theme.text }]}>{badge.name}</Text>
                                        <Text style={[styles.badgeStatus, { color: theme.textSecondary }]}>{badge.unlocked ? 'Unlocked' : 'Locked'}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>

                        {/* Milestone Badges */}
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>Milestone Achievements</Text>
                            <View style={styles.badgesGrid}>
                                {[
                                    { name: 'Month Full', icon: 'calendar-check', color: '#2A4B2A', unlocked: true },
                                    { name: 'Yogi Master', icon: 'yoga', color: '#6B7280', unlocked: false },
                                    { name: 'Strength Pro', icon: 'arm-flex', color: '#F59E0B', unlocked: true },
                                    { name: 'Speed Demon', icon: 'flash', color: '#6B7280', unlocked: false },
                                ].map((badge, index) => (
                                    <View key={index} style={[styles.badgeCard, { backgroundColor: theme.backgroundCard, borderColor: theme.border }, !badge.unlocked && styles.lockedBadge]}>
                                        <View style={[styles.badgeIconBg, { backgroundColor: badge.unlocked ? `${badge.color}20` : theme.backgroundInput }]}>
                                            <MaterialCommunityIcons
                                                name={(badge.unlocked ? badge.icon : 'lock') as any}
                                                size={24}
                                                color={badge.unlocked ? badge.color : theme.textMuted}
                                            />
                                        </View>
                                        <Text style={[styles.badgeName, { color: theme.text }]}>{badge.name}</Text>
                                        <Text style={[styles.badgeStatus, { color: theme.textSecondary }]}>{badge.unlocked ? 'Unlocked' : 'Locked'}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    </View>
                )}
                {activeTab === 'History' && (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Achievement History</Text>
                        <View style={styles.timelineContainer}>
                            {[
                                { date: 'Today', time: '2h ago', title: 'Cardio King', subtitle: 'Completed 100 cardio workouts', icon: 'heart-pulse', color: '#EF4444' },
                                { date: 'Yesterday', time: '1 day ago', title: 'Early Bird', subtitle: 'Worked out before 6 AM for 7 days', icon: 'weather-sunny', color: '#2A4B2A' },
                                { date: 'Dec 20', time: '5 days ago', title: 'First Step', subtitle: 'Completed your first workout', icon: 'medal', color: '#F59E0B' },
                                { date: 'Dec 18', time: '1 week ago', title: 'Month Full', subtitle: '30 consecutive workout days', icon: 'calendar-check', color: '#2A4B2A' },
                                { date: 'Dec 10', time: '2 weeks ago', title: 'Strength Pro', subtitle: 'Lifted 1000kg total', icon: 'arm-flex', color: '#F59E0B' },
                            ].map((item, index) => (
                                <View key={index} style={styles.timelineItem}>
                                    <View style={styles.timelineLeft}>
                                        <Text style={[styles.timelineDate, { color: theme.text }]}>{item.date}</Text>
                                        <Text style={[styles.timelineTime, { color: theme.textSecondary }]}>{item.time}</Text>
                                    </View>
                                    <View style={styles.timelineDot}>
                                        <View style={[styles.dotInner, { backgroundColor: item.color }]} />
                                        {index !== 4 && <View style={[styles.timelineLine, { backgroundColor: theme.border }]} />}
                                    </View>
                                    <View style={styles.timelineRight}>
                                        <View style={[styles.historyCard, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}>
                                            <View style={[styles.historyIconBg, { backgroundColor: `${item.color}20` }]}>
                                                <MaterialCommunityIcons name={item.icon as any} size={20} color={item.color} />
                                            </View>
                                            <View style={styles.historyContent}>
                                                <Text style={[styles.historyTitle, { color: theme.text }]}>{item.title}</Text>
                                                <Text style={[styles.historySubtitle, { color: theme.textSecondary }]}>{item.subtitle}</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
                <View style={{ height: 100 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
    },
    tabContainer: {
        flexDirection: 'row',
        borderRadius: 20,
        padding: 4,
    },
    tab: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
    },
    tabText: {
        fontSize: 12,
        fontWeight: '600',
    },
    streakCard: {
        borderRadius: 24,
        padding: 24,
        marginBottom: 24,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    streakContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    streakLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        marginBottom: 4,
    },
    streakCountContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    streakCount: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#FFF',
    },
    longestStreakBadge: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    longestStreakText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '500',
    },
    chartContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 6,
        height: 60,
    },
    chartBarContainer: {
        height: 60,
        justifyContent: 'flex-end',
    },
    chartBar: {
        width: 12,
        backgroundColor: '#FBBF24',
        borderRadius: 4,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    seeAllText: {
        fontSize: 14,
        fontWeight: '500',
    },
    milestonesScroll: {
        gap: 16,
        paddingRight: 20,
    },
    milestoneCard: {
        padding: 16,
        borderRadius: 20,
        alignItems: 'center',
        width: 140,
        borderWidth: 1,
    },
    milestoneTitle: {
        fontWeight: 'bold',
        marginTop: 12,
        marginBottom: 4,
        fontSize: 14,
        textAlign: 'center',
    },
    milestoneSubtitle: {
        fontSize: 10,
        marginBottom: 12,
        textAlign: 'center',
    },
    claimButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
    },
    claimButtonText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    inProgressBadge: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
    },
    inProgressText: {
        fontSize: 10,
        fontWeight: '500',
    },
    badgesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
    badgeCard: {
        width: (width - 56) / 2,
        padding: 16,
        borderRadius: 20,
        alignItems: 'center',
        borderWidth: 1,
    },
    lockedBadge: {
        opacity: 0.7,
    },
    badgeIconBg: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    badgeName: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4,
    },
    badgeStatus: {
        fontSize: 10,
    },
    milestoneRingContainer: {
        position: 'relative',
        width: 66,
        height: 66,
        justifyContent: 'center',
        alignItems: 'center',
    },
    milestoneIconOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    leaderboardTabs: {
        flexDirection: 'row',
        gap: 12,
    },
    leaderboardTabText: {
        fontSize: 12,
        fontWeight: '600',
    },
    leaderboardTabTextActive: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    podiumContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-end',
        marginBottom: 24,
        gap: 16,
    },
    podiumItem: {
        alignItems: 'center',
    },
    avatarContainer: {
        marginBottom: 8,
        position: 'relative',
    },
    avatarRing: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rankBadge1: {
        position: 'absolute',
        bottom: -6,
        alignSelf: 'center',
        backgroundColor: '#F59E0B',
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
    },
    rankBadge2: {
        position: 'absolute',
        bottom: -6,
        alignSelf: 'center',
        backgroundColor: '#2A4B2A',
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
    },
    rankBadge3: {
        position: 'absolute',
        bottom: -6,
        alignSelf: 'center',
        backgroundColor: '#FBD85D',
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
    },
    rankText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    podiumName: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 2,
    },
    podiumPoints: {
        fontSize: 10,
    },
    leaderboardList: {
        borderRadius: 20,
        padding: 16,
    },
    leaderboardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    listRank: {
        width: 24,
        fontWeight: 'bold',
        fontSize: 14,
    },
    listAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    listName: {
        flex: 1,
        fontWeight: '600',
    },
    listPoints: {
        fontWeight: 'bold',
    },
    badgesStatsContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    badgesStatCard: {
        flex: 1,
        padding: 16,
        borderRadius: 20,
        alignItems: 'center',
        borderWidth: 1,
    },
    badgesStatValue: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    badgesStatLabel: {
        fontSize: 12,
    },
    timelineContainer: {
        paddingVertical: 8,
    },
    timelineItem: {
        flexDirection: 'row',
        marginBottom: 24,
    },
    timelineLeft: {
        width: 80,
        paddingRight: 12,
    },
    timelineDate: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 2,
    },
    timelineTime: {
        fontSize: 11,
    },
    timelineDot: {
        width: 16,
        alignItems: 'center',
    },
    dotInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginTop: 4,
    },
    timelineLine: {
        width: 1,
        flex: 1,
        marginTop: 4,
    },
    timelineRight: {
        flex: 1,
        paddingLeft: 12,
    },
    historyCard: {
        flexDirection: 'row',
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
    },
    historyIconBg: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    historyContent: {
        flex: 1,
        justifyContent: 'center',
    },
    historyTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 2,
    },
    historySubtitle: {
        fontSize: 11,
    },
});
