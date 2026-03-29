import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    TextInput,
    Alert,
    FlatList,
    Image,
    StatusBar,
    RefreshControl,
    Modal
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { designSystem } from '../theme/designSystem';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { tribeService, mapTribe, Tribe, TribePost } from '../services/tribeService';
import { supabase } from '../services/supabase';
import { analyticsService } from '../services/analyticsService';
import { hapticService } from '../services/hapticService';
import { tribeNotificationService } from '../services/tribeNotificationService';
import { format, startOfWeek, endOfWeek, addDays, differenceInDays } from 'date-fns';
import { PostItem } from '../components/tribe/PostItem';

export default function TribeDashboardScreen({ route, navigation }: any) {
    const { tribeId } = route.params;
    const { user } = useAuth();
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = createStyles(theme, isDark, insets);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Data States
    const [tribe, setTribe] = useState<Tribe | null>(null);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [posts, setPosts] = useState<TribePost[]>([]);
    const [members, setMembers] = useState<any[]>([]); // Keep for chat reference

    // UI States
    const [viewMode, setViewMode] = useState<'leaderboard' | 'chat' | 'settings'>('leaderboard');
    const [newPost, setNewPost] = useState('');
    const [isPosting, setIsPosting] = useState(false);

    // Comments Modal State
    const [showCommentsModal, setShowCommentsModal] = useState(false);
    const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isCommentingLoading, setIsCommentingLoading] = useState(false);

    // Settings Edit State
    const [editName, setEditName] = useState('');
    const [editGoal, setEditGoal] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [editDuration, setEditDuration] = useState('60');
    const [editMaxMembers, setEditMaxMembers] = useState('50');

    // Initial Load
    useEffect(() => {
        analyticsService.trackScreenView('TribeDashboard', { tribeId });
        loadAllData();

        // Subscriptions
        const postChannel = tribeNotificationService.subscribeToTribePosts(
            tribeId, user?.id || '',
            async () => {
                fetchFeedData();
                hapticService.light();
            }
        );

        const memberChannel = tribeNotificationService.subscribeToNewMembers(
            tribeId,
            async () => {
                fetchLeaderboardData();
            }
        );

        const reactionsChannel = tribeNotificationService.subscribeToReactions(
            tribeId,
            async () => {
                fetchFeedData();
            }
        );

        const commentsChannel = tribeNotificationService.subscribeToComments(
            tribeId,
            async () => {
                fetchFeedData();
                if (selectedPostId) {
                    loadComments(selectedPostId);
                }
            }
        );

        return () => {
            tribeNotificationService.unsubscribe(postChannel);
            tribeNotificationService.unsubscribe(memberChannel);
            tribeNotificationService.unsubscribe(reactionsChannel);
            tribeNotificationService.unsubscribe(commentsChannel);
        };
    }, [tribeId, user?.id]);

    const loadAllData = async () => {
        try {
            setLoading(true);
            await Promise.all([
                fetchTribeDetails(),
                fetchLeaderboardData(),
                fetchFeedData()
            ]);
        } catch (error) {
            console.error('Data load error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        loadAllData();
        hapticService.selection();
    }, []);

    const fetchTribeDetails = async () => {
        const { data, error } = await supabase.from('rooms').select('*').eq('id', tribeId).eq('active', true).single();
        if (!error && data) {
            const mappedTribe = mapTribe(data);
            setTribe(mappedTribe);
            setEditName(mappedTribe.name || '');
            setEditGoal(mappedTribe.goal || '');
            setEditDescription(mappedTribe.description || '');
            setEditDuration((mappedTribe.durationDays || 60).toString());
            setEditMaxMembers((mappedTribe.maxMembers || 50).toString());
        } else {
            setTribe(null); // Ensure tribe is null if not found or inactive
        }
    };

    const fetchLeaderboardData = async () => {
        const data = await tribeService.fetchTribeLeaderboard(tribeId);
        setLeaderboard(data);
    };

    const fetchFeedData = async () => {
        const data = await tribeService.fetchTribePosts(tribeId);
        setPosts(data);
    };

    // --- Actions ---

    const handleCreatePost = async () => {
        if (!newPost.trim() || !user) return;
        setIsPosting(true);
        hapticService.medium();
        try {
            await tribeService.createTribePost(tribeId, user.id, newPost.trim());
            setNewPost('');
            fetchFeedData();
            hapticService.success();
        } catch (error) {
            Alert.alert('Error', 'Failed to post.');
        } finally {
            setIsPosting(false);
        }
    };

    const handleSaveSettings = async () => {
        try {
            setIsSaving(true);
            const updates = {
                name: editName,
                goal: editGoal,
                description: editDescription,
                durationDays: parseInt(editDuration) || 60,
                maxMembers: parseInt(editMaxMembers) || 50
            };
            await tribeService.updateTribeSettings(tribeId, updates);
            setTribe(prev => prev ? { ...prev, ...updates } : null);
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 2000);
            Alert.alert('Success', 'Tribe details updated successfully');
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to update settings');
        } finally {
            setIsSaving(false);
        }
    };

    const handleKickMember = async (memberId: string, memberName: string) => {
        Alert.alert('Remove Member', `Are you sure you want to remove ${memberName}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                    try {
                        const { error } = await supabase.from('room_members').delete().eq('room_id', tribeId).eq('user_id', memberId);
                        if (error) throw error;
                        fetchLeaderboardData(); // refresh list
                    } catch (e) {
                        Alert.alert('Error', 'Failed to remove member');
                    }
                }
            }
        ]);
    };

    const handleWarnMember = (memberName: string) => {
        // Mock warning
        Alert.alert('Warning Sent', `A warning notification has been sent to ${memberName}.`);
    };

    const handleLeaveTribe = async () => {
        Alert.alert("Leave Tribe", "Are you sure you want to leave this tribe?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Leave",
                style: "destructive",
                onPress: async () => {
                    try {
                        if (!user) return;
                        setLoading(true);
                        await tribeService.leaveTribe(tribeId, user.id);
                        hapticService.success();
                        navigation.navigate('Tribes'); // Go back to list
                    } catch (error: any) {
                        setLoading(false);
                        Alert.alert("Error", error.message || "Failed to leave tribe.");
                    }
                }
            }
        ]);
    };

    // --- Calculated Values ---
    const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const currentWeekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    const dateRangeString = `${format(currentWeekStart, 'MMM d')} - ${format(currentWeekEnd, 'MMM d')}`;

    // Safety check just in case created_at is missing or invalid
    const startDate = tribe?.startDate ? new Date(tribe.startDate) : (tribe ? new Date(tribe.createdAt) : new Date());
    const dayOfChallenge = differenceInDays(new Date(), startDate) + 1;
    const totalDays = tribe?.durationDays || 60;

    const handleDeleteTribe = async () => {
        Alert.alert(
            'Delete Tribe',
            'Are you sure you want to delete this tribe? This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            console.log('[TribeDashboard] Deleting tribe:', tribeId);
                            const { data, count, error } = await tribeService.deleteTribe(tribeId) as any;

                            if (error) throw error;

                            // Check if rows were affected. Supabase by default returns data if asked, 
                            // but we can check the count or data length.
                            if (!data || data.length === 0) {
                                console.warn('[TribeDashboard] Deletion query returned 0 rows. RLS likely blocked.');
                                throw new Error('Deletion failed. You may not have administrative rights to delete this tribe.');
                            }

                            console.log('[TribeDashboard] Deletion successful');
                            hapticService.success();
                            navigation.navigate('Tribes');
                        } catch (error: any) {
                            setLoading(false);
                            console.error('Delete tribe error:', error);
                            Alert.alert('Error', error.message || 'Failed to delete tribe. Check your permissions.');
                        }
                    }
                }
            ]
        );
    };

    const handleDeletePost = async (postId: string) => {
        Alert.alert('Delete Post', 'Remove this post from the feed?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        const { error } = await supabase.from('tribe_posts').delete().eq('id', postId);
                        if (error) {
                            // Fallback for legacy
                            const { error: legacyErr } = await supabase.from('room_posts').delete().eq('id', postId);
                            if (legacyErr) throw legacyErr;
                        }
                        fetchFeedData();
                        hapticService.success();
                    } catch (e) {
                        Alert.alert('Error', 'Failed to delete post');
                    }
                }
            }
        ]);
    };

    // --- Social Interaction Handlers ---

    const handleReaction = async (postId: string, reactionType: string) => {
        if (!user) return;
        try {
            await tribeService.addReaction(postId, user.id, reactionType);
            hapticService.light();
            fetchFeedData();
        } catch (error) {
            console.error('Failed to add reaction:', error);
        }
    };

    const handleRemoveReaction = async (postId: string) => {
        if (!user) return;
        try {
            await tribeService.removeReaction(postId, user.id);
            fetchFeedData();
        } catch (error) {
            console.error('Failed to remove reaction:', error);
        }
    };

    const handleReply = async (postId: string) => {
        setSelectedPostId(postId);
        setShowCommentsModal(true);
        await loadComments(postId);
    };

    const loadComments = async (postId: string) => {
        try {
            setIsCommentingLoading(true);
            const data = await tribeService.fetchComments(postId);
            setComments(data);
        } catch (error) {
            console.error('Failed to load comments:', error);
        } finally {
            setIsCommentingLoading(false);
        }
    };

    const handleAddComment = async () => {
        if (!newComment.trim() || !user || !selectedPostId) return;
        try {
            await tribeService.addComment(selectedPostId, user.id, newComment.trim());
            setNewComment('');
            await loadComments(selectedPostId);
            fetchFeedData(); // Refresh to update comment count
            hapticService.success();
        } catch (error) {
            Alert.alert('Error', 'Failed to post comment');
        }
    };

    // Admin Check - Either owner or global admin
    const isAdmin = tribe?.adminId === user?.id || user?.role === 'admin';

    // --- Render Components ---

    const renderHeader = () => (
        <View style={styles.header}>
            <View style={styles.headerTopUserRow}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
                <TouchableOpacity onPress={() => setViewMode('chat')} style={[styles.iconButton, viewMode === 'chat' && styles.iconButtonActive]}>
                    <MaterialCommunityIcons name="chat-outline" size={24} color={viewMode === 'chat' ? '#FFF' : theme.text} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setViewMode('settings')} style={[styles.iconButton, viewMode === 'settings' && styles.iconButtonActive]}>
                    <MaterialCommunityIcons name="cog-outline" size={24} color={viewMode === 'settings' ? '#FFF' : theme.text} />
                </TouchableOpacity>
            </View>

            <View style={styles.headerTitleRow}>
                <View>
                    <Text style={[styles.roomTitle, { color: theme.text }]}>{tribe?.name || 'Loading...'}</Text>
                    <Text style={styles.roomSubtitle}>
                        Day {dayOfChallenge} / {totalDays}
                    </Text>
                </View>
                {viewMode === 'leaderboard' && (
                    <View style={styles.weekBadge}>
                        <Text style={[styles.weekBadgeText, { color: theme.primary }]}>{dateRangeString}</Text>
                    </View>
                )}
            </View>
        </View>
    );

    const renderLeaderboard = () => (
        <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
        >
            {/* Week Nav / Legend */}
            <View style={styles.weekNavContainer}>
                <MaterialCommunityIcons name="chevron-left" size={24} color={theme.textSecondary} />
                <View style={{ alignItems: 'center' }}>
                    <Text style={[styles.weekLabel, { color: theme.textSecondary }]}>Current Week</Text>
                    <Text style={[styles.weekRange, { color: theme.text }]}>{dateRangeString}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color={theme.textSecondary} />
            </View>

            <View style={styles.legendContainer}>
                <View style={styles.legendItem}>
                    <View style={[styles.dot, { backgroundColor: '#4CAF50' }]} />
                    <Text style={[styles.legendText, { color: theme.textSecondary }]}>10 pts</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.dot, { backgroundColor: '#FFC107' }]} />
                    <Text style={[styles.legendText, { color: theme.textSecondary }]}>3 pts</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.dot, { backgroundColor: '#E0E0E0' }]} />
                    <Text style={[styles.legendText, { color: theme.textSecondary }]}>0 pts</Text>
                </View>
            </View>

            {/* List */}
            <View style={styles.leaderboardList}>
                {leaderboard.length === 0 && !loading && (
                    <Text style={{ textAlign: 'center', color: theme.textSecondary, marginTop: 20 }}>No members yet.</Text>
                )}
                {leaderboard.map((item, index) => {
                    const isCurrentUser = item.user.id === user?.id;
                    const isLeader = item.rank === 1;

                    return (
                        <TouchableOpacity
                            key={item.user.id}
                            style={[
                                styles.rankRow,
                                isDark ? designSystem.glass.dark : designSystem.glass.light,
                                isCurrentUser && styles.rankRowActive,
                                isLeader && { borderColor: '#FFD700', ...designSystem.shadows.glow('#FFD700') },
                                item.rank === 2 && { borderColor: '#C0C0C0' },
                                item.rank === 3 && { borderColor: '#CD7F32' },
                            ]}
                            onPress={() => !item.user.isBot && navigation.navigate('Profile', { userId: item.user.id })}
                            onLongPress={() => {
                                if (isAdmin && !isCurrentUser) {
                                    Alert.alert('Admin Actions', `Manage ${item.user.name}`, [
                                        { text: 'Cancel', style: 'cancel' },
                                        { text: 'Warn', onPress: () => handleWarnMember(item.user.name) },
                                        { text: 'Remove', style: 'destructive', onPress: () => handleKickMember(item.user.id, item.user.name) }
                                    ]);
                                }
                            }}
                        >
                            {/* Rank Badge */}
                            <View style={styles.rankContainer}>
                                <View style={[
                                    styles.rankCircle,
                                    item.rank === 1 ? [styles.rankGold, designSystem.shadows.glow('#FFD700')] :
                                        item.rank === 2 ? [{ backgroundColor: '#C0C0C0' }, designSystem.shadows.glow('#C0C0C0')] :
                                            item.rank === 3 ? [{ backgroundColor: '#CD7F32' }, designSystem.shadows.glow('#CD7F32')] :
                                                { backgroundColor: 'transparent' }
                                ]}>
                                    {item.rank === 1 ? (
                                        <MaterialCommunityIcons name="crown" size={14} color="#FFF" />
                                    ) : (
                                        <Text style={[styles.rankText, { color: item.rank > 3 ? theme.text : '#FFF' }]}>{item.rank}</Text>
                                    )}
                                </View>
                            </View>

                            {/* Avatar */}
                            <View style={styles.avatarContainer}>
                                {item.user.avatarUrl ? (
                                    <Image source={{ uri: item.user.avatarUrl }} style={styles.avatar} />
                                ) : (
                                    <View style={[styles.avatar, { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }]}>
                                        <Text style={{ color: '#FFF' }}>{item.user.name?.[0]}</Text>
                                    </View>
                                )}
                            </View>

                            {/* User Info & Dots */}
                            <View style={styles.userInfo}>
                                <View style={styles.nameRow}>
                                    <Text style={[styles.userName, { color: theme.text }]}>
                                        {item.user.name}
                                    </Text>
                                    {isLeader && (
                                        <View style={styles.leaderBadge}>
                                            <Text style={styles.leaderBadgeText}>leader</Text>
                                        </View>
                                    )}
                                </View>

                                {/* Dots Strip: M T W T F S S */}
                                <View style={styles.dotsRow}>
                                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, dIndex) => {
                                        const status = item.weeklyActivity[dIndex]; // 'none', 'full'
                                        return (
                                            <View key={dIndex} style={styles.dayDotContainer}>
                                                <Text style={styles.dayLabel}>{day}</Text>
                                                <View style={[
                                                    styles.dayDot,
                                                    status === 'full' && { backgroundColor: '#4CAF50' },
                                                    status === 'partial' && { backgroundColor: '#FFC107' },
                                                    status === 'none' && { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }
                                                ]} />
                                            </View>
                                        );
                                    })}
                                </View>
                            </View>

                            {/* Points */}
                            <Text style={[styles.pointsText, { color: theme.text }]}>{item.points} pts</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </ScrollView>
    );

    const renderChat = () => (
        <View style={{ flex: 1 }}>
            <FlatList
                data={posts}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: 20, paddingBottom: 150 }}
                renderItem={({ item }) => (
                    <PostItem
                        post={item}
                        currentUserId={user?.id || ''}
                        onReact={handleReaction}
                        onRemoveReaction={handleRemoveReaction}
                        onReply={handleReply}
                        onDelete={handleDeletePost}
                        isAdmin={isAdmin}
                        theme={theme}
                        isDark={isDark}
                    />
                )}
            />
            <View style={styles.chatInputContainer}>
                <TextInput
                    style={[styles.chatInput, { color: theme.text, backgroundColor: theme.background }]}
                    placeholder="Message the team..."
                    placeholderTextColor={theme.textSecondary}
                    value={newPost}
                    onChangeText={setNewPost}
                />
                <TouchableOpacity onPress={handleCreatePost} style={styles.sendButton}>
                    {isPosting ? <ActivityIndicator color="#FFF" size="small" /> : <MaterialCommunityIcons name="send" size={20} color="#FFF" />}
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderSettings = () => (
        <ScrollView style={styles.scrollContent}>
            <View style={styles.settingsSection}>
                <Text style={[styles.sectionHeader, { color: theme.text }]}>Tribe Details</Text>

                {isAdmin ? (
                    <View style={{ marginBottom: 20 }}>
                        <Text style={[styles.label, { color: theme.textSecondary }]}>Tribe Name</Text>
                        <TextInput
                            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundInput }]}
                            value={editName}
                            onChangeText={setEditName}
                            placeholder="Tribe Name"
                            placeholderTextColor={theme.textMuted}
                        />

                        <Text style={[styles.label, { color: theme.textSecondary, marginTop: 15 }]}>Description</Text>
                        <TextInput
                            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundInput, height: 80 }]}
                            value={editDescription}
                            onChangeText={setEditDescription}
                            multiline
                            placeholder="Describe the tribe's mission..."
                            placeholderTextColor={theme.textMuted}
                        />

                        <Text style={[styles.label, { color: theme.textSecondary, marginTop: 15 }]}>Primary Goal</Text>
                        <TextInput
                            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundInput }]}
                            value={editGoal}
                            onChangeText={setEditGoal}
                            multiline
                            placeholder="E.g. Lose 5kg in 60 days"
                            placeholderTextColor={theme.textMuted}
                        />

                        <View style={{ flexDirection: 'row', gap: 15, marginTop: 15 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.label, { color: theme.textSecondary }]}>Member Limit</Text>
                                <TextInput
                                    style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundInput }]}
                                    value={editMaxMembers}
                                    onChangeText={setEditMaxMembers}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.label, { color: theme.textSecondary }]}>Duration (Days)</Text>
                                <TextInput
                                    style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundInput }]}
                                    value={editDuration}
                                    onChangeText={setEditDuration}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[
                                styles.saveSettingsButton,
                                { backgroundColor: isSaved ? '#4BB543' : theme.primary, marginTop: 30 },
                                (isSaving || isSaved) && { opacity: 0.9 }
                            ]}
                            onPress={handleSaveSettings}
                            disabled={isSaving || isSaved}
                        >
                            <Text style={styles.saveSettingsText}>
                                {isSaving ? 'Saving...' : (isSaved ? 'Saved!' : 'Save All Changes')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        <View style={styles.infoRow}>
                            <Text style={[styles.label, { color: theme.textSecondary }]}>Rules</Text>
                            <Text style={[styles.value, { color: theme.text }]}>{tribe?.rules || 'No rules set.'}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={[styles.label, { color: theme.textSecondary }]}>Goal</Text>
                            <Text style={[styles.value, { color: theme.text }]}>{tribe?.goal || 'No goal set.'}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={[styles.label, { color: theme.textSecondary }]}>Description</Text>
                            <Text style={[styles.value, { color: theme.text }]}>{tribe?.description || 'No description.'}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={[styles.label, { color: theme.textSecondary }]}>Capacity</Text>
                            <Text style={[styles.value, { color: theme.text }]}>{tribe?.memberCount || 0} / {tribe?.maxMembers || 50}</Text>
                        </View>
                    </>
                )}
            </View>

            {isAdmin && (
                <View style={styles.settingsSection}>
                    <Text style={[styles.sectionHeader, { color: theme.text }]}>Manage Members</Text>
                    <Text style={{ color: '#888', marginBottom: 10, fontSize: 13 }}>Long-press any member on the leaderboard to remove or warn them.</Text>
                </View>
            )}

            <TouchableOpacity style={[styles.dangerButton, { backgroundColor: `${theme.error}15`, borderColor: theme.error }]} onPress={handleLeaveTribe}>
                <Text style={[styles.dangerButtonText, { color: theme.error }]}>Leave Tribe</Text>
            </TouchableOpacity>

            {isAdmin && (
                <TouchableOpacity
                    style={[styles.dangerButton, { marginTop: 0, backgroundColor: `${theme.error}15`, borderColor: theme.error }]}
                    onPress={handleDeleteTribe || (() => Alert.alert('Error', 'Deletion function not found'))}
                >
                    <Text style={[styles.dangerButtonText, { color: theme.error }]}>Delete Tribe (Admin)</Text>
                </TouchableOpacity>
            )}
        </ScrollView>
    );

    const renderCommentsModal = () => (
        <Modal visible={showCommentsModal} animationType="slide" transparent={true}>
            <View style={[styles.modalOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.6)' }]}>
                <View style={[styles.commentsModal, { backgroundColor: isDark ? '#1A1525' : theme.backgroundCard }]}>
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { color: theme.text }]}>Comments</Text>
                        <TouchableOpacity onPress={() => setShowCommentsModal(false)}>
                            <MaterialCommunityIcons name="close" size={24} color={theme.text} />
                        </TouchableOpacity>
                    </View>

                    {isCommentingLoading ? (
                        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
                    ) : (
                        <ScrollView style={styles.commentsScroll} contentContainerStyle={{ paddingBottom: 20 }}>
                            {comments.length === 0 ? (
                                <Text style={{ textAlign: 'center', color: theme.textSecondary, marginTop: 20 }}>
                                    No comments yet. Be the first!
                                </Text>
                            ) : (
                                comments.map(comment => (
                                    <View key={comment.id} style={styles.commentItem}>
                                        <Image
                                            source={{ uri: comment.users?.avatarUrl || 'https://via.placeholder.com/40' }}
                                            style={styles.commentAvatar}
                                        />
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                                <Text style={[styles.commentName, { color: theme.text }]}>
                                                    {comment.users?.name || 'Anonymous'}
                                                </Text>
                                                <Text style={[styles.commentTime, { color: theme.textSecondary }]}>
                                                    {format(new Date(comment.createdAt), 'MMM d, h:mm a')}
                                                </Text>
                                            </View>
                                            <Text style={[styles.commentText, { color: theme.text }]}>
                                                {comment.content}
                                            </Text>
                                        </View>
                                    </View>
                                ))
                            )}
                        </ScrollView>
                    )}

                    <View style={styles.commentInputContainer}>
                        <TextInput
                            style={[styles.commentInput, { color: theme.text, backgroundColor: theme.backgroundInput, borderColor: theme.border }]}
                            placeholder="Write a comment..."
                            placeholderTextColor={theme.textMuted}
                            value={newComment}
                            onChangeText={setNewComment}
                            multiline
                        />
                        <TouchableOpacity
                            onPress={handleAddComment}
                            style={[styles.commentSendButton, { backgroundColor: theme.primary }]}
                        >
                            <MaterialCommunityIcons name="send" size={20} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    if (loading) return (
        <View style={[styles.loading, { backgroundColor: theme.background }]}>
            <ActivityIndicator size="large" color={theme.primary} />
        </View>
    );

    if (!tribe) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center', paddingTop: insets.top }]}>
                <MaterialCommunityIcons name="alert-circle-outline" size={64} color={theme.textMuted} />
                <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold', marginTop: 16 }}>Tribe not found</Text>
                <TouchableOpacity
                    style={{ marginTop: 24, padding: 12, backgroundColor: theme.primary, borderRadius: 8, paddingHorizontal: 24 }}
                    onPress={() => navigation.navigate('Tribes')}
                >
                    <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Back to Explore</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle="light-content" />

            {renderHeader()}

            <View style={styles.mainContent}>
                {viewMode === 'leaderboard' && renderLeaderboard()}
                {viewMode === 'chat' && renderChat()}
                {viewMode === 'settings' && renderSettings()}
            </View>
            {renderCommentsModal()}
        </View>
    );
}

const createStyles = (theme: any, isDark: boolean, insets: any) => StyleSheet.create({
    container: {
        flex: 1,
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    header: {
        paddingTop: insets.top + 10,
        paddingHorizontal: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    headerTopUserRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
        marginTop: 10,
    },
    backButton: {
        padding: 5,
    },
    iconButton: {
        padding: 10,
        backgroundColor: theme.backgroundInput,
        borderRadius: 20,
        marginLeft: 10,
    },
    iconButtonActive: {
        backgroundColor: theme.primary,
    },
    headerTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    roomTitle: {
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    roomSubtitle: {
        fontSize: 14,
        color: theme.textSecondary,
        marginTop: 4,
        fontWeight: '500',
    },
    weekBadge: {
        backgroundColor: `${theme.primary}15`,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    weekBadgeText: {
        fontWeight: '700',
        fontSize: 12,
    },
    mainContent: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    weekNavContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 20,
    },
    weekLabel: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    weekRange: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 4,
    },
    legendContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
        marginBottom: 20,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    legendText: {
        fontSize: 12,
        fontWeight: '500',
    },
    leaderboardList: {
        paddingHorizontal: 16,
        gap: 12,
    },
    rankRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
    },
    rankRowActive: {
        borderColor: theme.primary,
        backgroundColor: `${theme.primary}05`,
    },
    rankContainer: {
        width: 30,
        alignItems: 'center',
        marginRight: 10,
    },
    rankGold: {
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    rankCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    rankText: {
        fontWeight: 'bold',
        fontSize: 14,
    },
    avatarContainer: {
        marginRight: 12,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    userInfo: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    userName: {
        fontWeight: '700',
        fontSize: 15,
        marginRight: 8,
    },
    leaderBadge: {
        backgroundColor: 'rgba(255,215,0,0.15)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.3)',
    },
    leaderBadgeText: {
        color: '#FFD700',
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    dotsRow: {
        flexDirection: 'row',
        gap: 6,
    },
    dayDotContainer: {
        alignItems: 'center',
        gap: 4,
    },
    dayLabel: {
        fontSize: 9,
        color: theme.textMuted,
        fontWeight: '600',
    },
    dayDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    pointsText: {
        fontSize: 18,
        fontWeight: '800',
        marginLeft: 10,
    },
    chatInputContainer: {
        padding: 15,
        paddingBottom: 40,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    chatInput: {
        flex: 1,
        height: 44,
        borderRadius: 22,
        paddingHorizontal: 20,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    chatMessage: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    chatAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        marginRight: 10,
    },
    chatContent: {
        flex: 1,
        backgroundColor: theme.backgroundCard,
        padding: 12,
        borderRadius: 16,
        borderTopLeftRadius: 4,
        borderWidth: 1,
        borderColor: theme.border,
    },
    chatHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    chatName: {
        fontWeight: '700',
        fontSize: 13,
    },
    chatTime: {
        fontSize: 11,
        color: theme.textMuted,
    },
    chatText: {
        fontSize: 14,
        lineHeight: 20,
    },
    chatProgressBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
        backgroundColor: 'rgba(255,215,0,0.1)',
        padding: 6,
        borderRadius: 8,
    },
    chatProgressText: {
        color: '#FFD700',
        fontSize: 12,
        fontWeight: '600',
    },
    settingsSection: {
        padding: 20,
    },
    sectionHeader: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 15,
    },
    infoRow: {
        marginBottom: 20,
    },
    label: {
        fontSize: 13,
        marginBottom: 5,
        textTransform: 'uppercase',
        fontWeight: '600',
    },
    value: {
        fontSize: 15,
        lineHeight: 22,
    },
    dangerButton: {
        margin: 20,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
    },
    dangerButtonText: {
        fontWeight: '700',
    },
    input: {
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        marginBottom: 10,
    },
    saveSettingsButton: {
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
    },
    saveSettingsText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    // Comments Modal Styles
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end'
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 25
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold'
    },
    commentsModal: {
        borderTopLeftRadius: 35,
        borderTopRightRadius: 35,
        padding: 25,
        maxHeight: '80%'
    },
    commentsScroll: {
        maxHeight: 400,
        marginVertical: 15
    },
    commentItem: {
        flexDirection: 'row',
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)'
    },
    commentAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 10
    },
    commentName: {
        fontWeight: 'bold',
        fontSize: 13,
        marginRight: 8
    },
    commentTime: {
        fontSize: 11
    },
    commentText: {
        fontSize: 14,
        lineHeight: 20
    },
    commentInputContainer: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'flex-end',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
        paddingTop: 15
    },
    commentInput: {
        flex: 1,
        borderRadius: 15,
        padding: 12,
        fontSize: 14,
        borderWidth: 1,
        maxHeight: 100
    },
    commentSendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center'
    },
});
