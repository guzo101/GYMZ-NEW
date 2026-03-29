import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { designSystem } from '../theme/designSystem';
import { leaderboardService, LeaderboardUser } from '../services/leaderboardService';
import { ScreenHeader } from '../components/ScreenHeader';
import { DynamicBackground } from '../components/dashboard/DynamicBackground';
import { DataMapper } from '../utils/dataMapper';

export default function LeaderboardScreen({ navigation }: any) {
    const { user } = useAuth();
    const { theme, isDark } = useTheme();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
    const [userRank, setUserRank] = useState<any>(null);
    const [mode, setMode] = useState<'global' | 'events'>(user?.accessMode === 'event_access' ? 'events' : 'global');

    const fetchData = async () => {
        try {
            setLoading(true);
            const [lbData, rankData] = await Promise.all([
                leaderboardService.fetchGlobalLeaderboard(), // TODO: Add fetchEventLeaderboard to service
                user?.id ? leaderboardService.getUserRank(user.id) : null
            ]);

            // Filter locally for now if mode is 'events'
            const filteredData = mode === 'events'
                ? lbData.filter((u: any) => u.accessMode === 'event_access')
                : lbData;

            setLeaderboard(DataMapper.fromDb<any[]>(filteredData));
            setUserRank(rankData);
        } catch (error) {
            console.error('Error loading leaderboard:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const renderHeader = () => {
        const topThree = leaderboard.slice(0, 3);
        if (topThree.length < 3) return null;

        return (
            <View style={styles.topThreeContainer}>
                {/* 2nd Place */}
                <View style={[styles.podiumItem, { marginTop: 40 }]}>
                    <View style={styles.avatarWrapper}>
                        {topThree[1].avatarUrl ? (
                            <Image source={{ uri: topThree[1].avatarUrl }} style={styles.topAvatar} />
                        ) : (
                            <View style={[styles.topAvatar, styles.avatarPlaceholder, { backgroundColor: '#1e293b' }]}>
                                <Text style={styles.avatarInitialText}>{topThree[1].name.charAt(0)}</Text>
                            </View>
                        )}
                        <View style={[styles.rankBadge, { backgroundColor: '#94A3B8' }]}>
                            <Text style={styles.rankBadgeText}>2</Text>
                        </View>
                    </View>
                    <Text style={[styles.topName, { color: theme.text }]} numberOfLines={1}>{topThree[1].name}</Text>
                    <Text style={styles.topPoints}>{topThree[1].totalPoints.toLocaleString()} XP</Text>
                </View>

                {/* 1st Place */}
                <View style={[styles.podiumItem, { zIndex: 10 }]}>
                    <MaterialCommunityIcons name="crown" size={32} color="#FFD700" style={{ marginBottom: -8 }} />
                    <View style={[styles.avatarWrapper, { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#FFD700' }]}>
                        {topThree[0].avatarUrl ? (
                            <Image source={{ uri: topThree[0].avatarUrl }} style={[styles.topAvatar, { width: 92, height: 92 }]} />
                        ) : (
                            <View style={[styles.topAvatar, styles.avatarPlaceholder, { width: 92, height: 92, backgroundColor: '#1e293b' }]}>
                                <Text style={[styles.avatarInitialText, { fontSize: 32 }]}>{topThree[0].name.charAt(0)}</Text>
                            </View>
                        )}
                        <View style={[styles.rankBadge, { backgroundColor: '#FFD700', width: 28, height: 28, borderRadius: 14 }]}>
                            <Text style={[styles.rankBadgeText, { color: '#000' }]}>1</Text>
                        </View>
                    </View>
                    <Text style={[styles.topName, { color: theme.text, fontSize: 18 }]} numberOfLines={1}>{topThree[0].name}</Text>
                    <Text style={[styles.topPoints, { color: theme.primary, fontSize: 16 }]}>{topThree[0].totalPoints.toLocaleString()} XP</Text>
                </View>

                {/* 3rd Place */}
                <View style={[styles.podiumItem, { marginTop: 60 }]}>
                    <View style={styles.avatarWrapper}>
                        {topThree[2].avatarUrl ? (
                            <Image source={{ uri: topThree[2].avatarUrl }} style={styles.topAvatar} />
                        ) : (
                            <View style={[styles.topAvatar, styles.avatarPlaceholder, { backgroundColor: '#1e293b' }]}>
                                <Text style={styles.avatarInitialText}>{topThree[2].name.charAt(0)}</Text>
                            </View>
                        )}
                        <View style={[styles.rankBadge, { backgroundColor: '#CD7F32' }]}>
                            <Text style={styles.rankBadgeText}>3</Text>
                        </View>
                    </View>
                    <Text style={[styles.topName, { color: theme.text }]} numberOfLines={1}>{topThree[2].name}</Text>
                    <Text style={styles.topPoints}>{topThree[2].totalPoints.toLocaleString()} XP</Text>
                </View>
            </View>
        );
    };

    const renderItem = ({ item, index }: { item: LeaderboardUser; index: number }) => {
        const isMe = item.userId === user?.id;
        if (index < 3) return null; // Already in top three header

        return (
            <View style={[
                styles.rankItem,
                { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.8)', borderColor: theme.border },
                isMe && { borderColor: theme.primary, borderWidth: 1.5, backgroundColor: `${theme.primary}10` }
            ]}>
                <Text style={[styles.itemRank, { color: theme.textSecondary }]}>{index + 1}</Text>
                {item.avatarUrl ? (
                    <Image source={{ uri: item.avatarUrl }} style={styles.itemAvatar} />
                ) : (
                    <View style={[styles.itemAvatar, styles.avatarPlaceholder, { backgroundColor: theme.backgroundInput }]}>
                        <Text style={[styles.avatarInitialText, { color: theme.textSecondary, fontSize: 16 }]}>{item.name.charAt(0)}</Text>
                    </View>
                )}
                <View style={styles.itemInfo}>
                    <Text style={[styles.itemName, { color: theme.text }]}>{item.name} {!!isMe && "(You)"}</Text>
                </View>
                <View style={styles.itemPointsContainer}>
                    <Text style={[styles.itemPoints, { color: theme.primary }]}>{item.totalPoints.toLocaleString()}</Text>
                    <Text style={[styles.itemPointsLabel, { color: theme.textMuted }]}>XP</Text>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <DynamicBackground rotationType="fixed" fixedIndex={6} />
            <ScreenHeader title={mode === 'events' ? 'Event Standings' : 'Community Standings'} />

            {/* Mode Switcher */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, mode === 'global' && { backgroundColor: theme.primary }]}
                    onPress={() => setMode('global')}
                >
                    <Text style={[styles.tabText, mode === 'global' && { color: '#fff' }]}>Gym Members</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, mode === 'events' && { backgroundColor: theme.primary }]}
                    onPress={() => setMode('events')}
                >
                    <Text style={[styles.tabText, mode === 'events' && { color: '#fff' }]}>Event Attendees</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={leaderboard}
                renderItem={renderItem}
                keyExtractor={(item) => item.userId}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={renderHeader}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
            />

            {/* My Fixed Rank Banner */}
            {!!userRank && (
                <View style={[styles.myRankBanner, { backgroundColor: theme.backgroundCard, borderTopColor: theme.border }]}>
                    <View style={styles.myRankLeft}>
                        <Text style={[styles.myRankLabel, { color: theme.textSecondary }]}>YOUR RANK</Text>
                        <View style={styles.myRankValueRow}>
                            <Text style={[styles.myRankValue, { color: theme.text }]}>#{userRank.rank || '--'}</Text>
                            <View style={[styles.myRankTrend, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                                <Ionicons name="caret-up" size={12} color="#10B981" />
                                <Text style={styles.trendText}>2</Text>
                            </View>
                        </View>
                    </View>
                    <LinearGradient
                        colors={[theme.primary, theme.primaryLight]}
                        style={styles.myPointsChip}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    >
                        <Text style={styles.myPointsText}>{userRank.totalPoints?.toLocaleString() || 0} Points</Text>
                    </LinearGradient>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 120,
    },
    topThreeContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingVertical: 32,
        marginBottom: 20,
    },
    podiumItem: {
        alignItems: 'center',
        width: 100,
    },
    avatarWrapper: {
        width: 70,
        height: 70,
        borderRadius: 35,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1e293b',
        position: 'relative',
        marginBottom: 12,
    },
    avatarPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitialText: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: 'bold',
    },
    topAvatar: {
        width: 62,
        height: 62,
        borderRadius: 31,
    },
    rankBadge: {
        position: 'absolute',
        bottom: -5,
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    rankBadgeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '900',
    },
    topName: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 4,
        textAlign: 'center',
    },
    topPoints: {
        fontSize: 12,
        fontWeight: '600',
        color: '#94A3B8',
    },
    rankItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1,
    },
    itemRank: {
        fontSize: 16,
        fontWeight: '800',
        width: 30,
    },
    itemAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: 16,
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        fontSize: 16,
        fontWeight: '700',
    },
    itemPointsContainer: {
        alignItems: 'flex-end',
    },
    itemPoints: {
        fontSize: 17,
        fontWeight: '800',
    },
    itemPointsLabel: {
        fontSize: 10,
        fontWeight: '700',
        marginTop: -2,
    },
    myRankBanner: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        paddingBottom: 34,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    myRankLeft: {
        gap: 4,
    },
    myRankLabel: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
    },
    myRankValueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    myRankValue: {
        fontSize: 24,
        fontWeight: '900',
    },
    myRankTrend: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        gap: 2,
    },
    trendText: {
        color: '#10B981',
        fontSize: 10,
        fontWeight: '800',
    },
    myPointsChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 14,
    },
    myPointsText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '800',
    },
    tabContainer: {
        flexDirection: 'row',
        marginHorizontal: 20,
        marginBottom: 10,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 4,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 10,
    },
    tabText: {
        fontSize: 13,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.4)',
    },
});
