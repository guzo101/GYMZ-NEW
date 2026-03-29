import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    RefreshControl,
    Modal,
    TextInput,
    ScrollView,
    Alert,
    Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../services/supabase';
import { tribeService, Tribe } from '../services/tribeService';
import { analyticsService } from '../services/analyticsService';
import { hapticService } from '../services/hapticService';
import { DynamicBackground } from '../components/dashboard/DynamicBackground';

export default function TribesScreen({ navigation }: any) {
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const { theme, isDark, gender } = useTheme();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [tribes, setTribes] = useState<Tribe[]>([]);
    const [userTribeId, setUserTribeId] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Limit Tracking
    const [joinedCount, setJoinedCount] = useState(0);
    const [createdCount, setCreatedCount] = useState(0);

    // Error tracking
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [userTribeName, setUserTribeName] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [isJoining, setIsJoining] = useState<string | null>(null);

    // Create Tribe Form
    const [tribeTitle, setTribeTitle] = useState('');
    const [tribeCategory, setTribeCategory] = useState('');
    const [tribeDescription, setTribeDescription] = useState('');
    const [tribeGoal, setTribeGoal] = useState('');
    const [tribeRules, setTribeRules] = useState('');
    const [tribeMaxMembers, setTribeMaxMembers] = useState('50');
    const [tribeDuration, setTribeDuration] = useState('60');
    const [isCreating, setIsCreating] = useState(false);

    // New Tribe Fields
    const [tribeVibe, setTribeVibe] = useState('Supportive');
    const [tribeLevel, setTribeLevel] = useState('All Levels');
    const [isWomenOnly, setIsWomenOnly] = useState(false);

    const categories = useMemo(() => {
        const base = [
            'All',
            'Beginner Friendly',
            'Strength Training',
            'Cardio',
            'Yoga',
            'Weight Loss',
            'Muscle Building',
            'Mindfulness & Wellness',
            'Low Impact',
            'Dance & Movement'
        ];

        if (gender === 'female') {
            const femaleCats = [...base];
            // Insert female-specific categories
            femaleCats.splice(2, 0, "Women's Health");
            femaleCats.splice(9, 0, 'Prenatal & Postpartum');
            return femaleCats;
        }

        return base;
    }, [gender]);

    const fetchData = useCallback(async () => {
        console.log('[TribesScreen] fetchData: starting...');
        setLoading(true);
        try {
            console.log('[TribesScreen] fetchData: fetching all tribes...');
            let allTribes = await tribeService.fetchTribes();

            if (searchQuery) {
                allTribes = await tribeService.searchTribes(searchQuery);
            }

            if (selectedCategory !== 'All') {
                allTribes = allTribes.filter((l: any) => l.category === selectedCategory);
            }

            // GENDER FILTER: Hide female-specific tribes if not female
            if (gender !== 'female') {
                allTribes = allTribes.filter((r: any) =>
                    !r.isWomenOnly &&
                    r.category !== "Women's Health" &&
                    r.category !== 'Prenatal & Postpartum'
                );
            }

            console.log('[TribesScreen] fetchData: fetching user tribe membership...');
            const myTribe = user ? await tribeService.getUserTribe(user.id) : null;

            // Limit checks
            if (user) {
                const { data: memberRows } = await (supabase as any)
                    .from('room_members')
                    .select('room_id, rooms!inner(active)')
                    .eq('user_id', user.id)
                    .eq('rooms.active', true);
                setJoinedCount(memberRows?.length || 0);

                const { data: adminRows } = await (supabase as any)
                    .from('rooms')
                    .select('id')
                    .eq('admin_id', user.id)
                    .eq('active', true);
                setCreatedCount(adminRows?.length || 0);
            }

            console.log('[TribesScreen] fetchData: success. User in tribe:', myTribe?.name || 'none');
            setTribes(allTribes || []);
            setUserTribeId(myTribe?.id || null);
            setUserTribeName(myTribe?.name || null);
        } catch (error) {
            console.error('[TribesScreen] fetchData error:', error);
        } finally {
            console.log('[TribesScreen] fetchData: finished.');
            setLoading(false);
            setRefreshing(false);
        }
    }, [user, searchQuery, selectedCategory, gender]);

    useEffect(() => {
        fetchData();
        const unsubscribe = navigation.addListener('focus', () => {
            console.log('[TribesScreen] Screen focused, refreshing...');
            fetchData();
        });
        return unsubscribe;
    }, [fetchData, navigation]);

    const handleCreateTribe = async () => {
        console.log('[TribesScreen] handleCreateTribe called');
        setSubmitError(null);
        if (!tribeTitle || !tribeCategory || !user) {
            console.log('[TribesScreen] Validation failed: missing title/cat/user');
            setSubmitError('Tribe name and category are required.');
            return;
        }

        if (createdCount >= 2) {
            setSubmitError('You have already created the maximum of 2 tribes.');
            return;
        }

        try {
            setIsCreating(true);
            hapticService.medium();

            console.log('[TribesScreen] Calling tribeService.createTribe...');
            const tribe = await tribeService.createTribe({
                name: tribeTitle.trim(),
                category: tribeCategory,
                description: tribeDescription.trim(),
                goal: tribeGoal.trim(),
                rules: tribeRules.trim() || 'Welcome!',
                maxMembers: parseInt(tribeMaxMembers) || 50,
                durationDays: parseInt(tribeDuration) || 60,
                experienceLevel: tribeLevel,
                communityVibe: tribeVibe,
                isWomenOnly: isWomenOnly,
                activeLevel: 'Daily Active'
            }, user.id, user.gymId || '');

            console.log('[TribesScreen] createTribe SUCCESS. Result ID:', tribe?.id);

            if (!tribe || !tribe.id) {
                console.error('[TribesScreen] Tribe data is missing ID!');
                throw new Error('Server returned invalid data.');
            }

            // SUCCESS FLOW
            console.log('[TribesScreen] Closing modal and navigating...');
            setShowCreateModal(false);
            setTribeTitle('');
            setTribeDescription('');
            setTribeGoal('');
            setTribeRules('');

            hapticService.success();

            // Navigate immediately
            console.log('[TribesScreen] Navigating to TribeDashboard:', tribe.id);
            navigation.navigate('TribeDashboard', { tribeId: tribe.id });

            // REFRESH DATA in background so the list is updated when we come back
            fetchData();
        } catch (error: any) {
            const msg = error.message || 'Unknown error occurred.';
            console.error('[TribesScreen] handleCreateTribe error caught:', msg);
            setSubmitError(msg);

            if (Platform.OS === 'web') {
                window.alert('Creation Failed: ' + msg);
            }
        } finally {
            console.log('[TribesScreen] handleCreateTribe FINALLY: resetting state');
            setIsCreating(false);
        }
    };

    const handleJoinTribe = async (tribeId: string) => {
        if (!user) return;
        if (joinedCount >= 2) {
            Alert.alert('Notice', 'You are already in 2 tribes. Please leave one before joining another.');
            return;
        }
        try {
            setIsJoining(tribeId);
            hapticService.medium();
            await tribeService.joinTribe(tribeId, user.id);
            hapticService.success();
            await fetchData();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to join tribe');
        } finally {
            setIsJoining(null);
        }
    };

    const renderTribeItem = ({ item }: { item: Tribe }) => {
        const isJoined = tribes.some(t => t.id === item.id && tribes.find(tribe => tribe.id === item.id)?.id === userTribeId); // simplistic check
        const isMyTribe = item.id === userTribeId;

        // Get vibe icon
        const getVibeIcon = () => {
            if (item.communityVibe === 'Competitive') return 'trophy';
            if (item.communityVibe === 'Laid-back') return 'coffee';
            return 'heart'; // Supportive
        };

        // Get vibe color
        const getVibeColor = () => {
            if (item.communityVibe === 'Competitive') return '#F59E0B';
            if (item.communityVibe === 'Laid-back') return '#2A4B2A';
            return '#F1C93B'; // Supportive
        };

        const isAdminOfTribe = item.adminId === user?.id;

        return (
            <TouchableOpacity
                style={[styles.roomCard, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.8)', borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}
                onPress={() => {
                    console.log('[TribesScreen] Navigating to tribe:', item.id);
                    navigation.navigate('TribeDashboard', { tribeId: item.id });
                }}
            >
                <View style={styles.roomHeader}>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                            <Text style={[styles.roomName, { color: theme.text }]}>{item.name}</Text>
                            {item.isWomenOnly && (
                                <View style={[styles.womenOnlyBadge, { backgroundColor: '#F1C93B20', marginLeft: 8 }]}>
                                    <MaterialCommunityIcons name="gender-female" size={14} color="#F1C93B" />
                                </View>
                            )}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.roomCategory, { color: theme.primary }]}>{item.category}</Text>
                            {item.experienceLevel && item.experienceLevel.includes('Beginner') && (
                                <View style={[styles.beginnerBadge, { backgroundColor: '#10B98120' }]}>
                                    <MaterialCommunityIcons name="sprout" size={10} color="#10B981" />
                                    <Text style={[styles.beginnerText, { color: '#10B981' }]}>BEGINNER OK</Text>
                                </View>
                            )}
                        </View>
                    </View>
                    <View style={styles.memberBadge}>
                        <MaterialCommunityIcons name="account-group" size={14} color={theme.textSecondary} />
                        <Text style={[styles.memberCount, { color: theme.textSecondary }]}>
                            {item.memberCount} / {item.maxMembers || 50}
                        </Text>
                    </View>
                </View>

                <Text style={[styles.roomDescription, { color: theme.textSecondary }]} numberOfLines={2}>
                    {item.description || 'No description provided.'}
                </Text>

                {/* Enhanced Badges Row */}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 16 }}>
                    {item.communityVibe && (
                        <View style={[styles.vibeBadge, { backgroundColor: getVibeColor() + '15' }]}>
                            <MaterialCommunityIcons name={getVibeIcon() as any} size={12} color={getVibeColor()} />
                            <Text style={[styles.vibeBadgeText, { color: getVibeColor() }]}>{item.communityVibe}</Text>
                        </View>
                    )}
                    {item.activeLevel && (
                        <View style={[styles.activityBadge, { backgroundColor: theme.primary + '15' }]}>
                            <MaterialCommunityIcons name="calendar-check" size={12} color={theme.primary} />
                            <Text style={[styles.activityBadgeText, { color: theme.primary }]}>{item.activeLevel}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.roomFooter}>
                    <View style={styles.activityIndicator}>
                        <View style={styles.activeDot} />
                        <Text style={[styles.activityText, { color: theme.textSecondary }]}>Active Now</Text>
                    </View>

                    {isMyTribe ? (
                        isAdminOfTribe ? (
                            <View style={[styles.statusBadge, { backgroundColor: theme.primary + '20' }]}>
                                <Text style={[styles.statusText, { color: theme.primary }]}>YOU ARE ADMIN</Text>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={[styles.leaveButton, { backgroundColor: theme.error + '15' }, isJoining === item.id && { opacity: 0.7 }]}
                                onPress={() => {
                                    Alert.alert(
                                        'Leave Tribe',
                                        'Are you sure you want to leave this tribe?',
                                        [
                                            { text: 'Cancel', style: 'cancel' },
                                            {
                                                text: 'Leave',
                                                style: 'destructive',
                                                onPress: async () => {
                                                    if (!user) return;
                                                    try {
                                                        setIsJoining(item.id);
                                                        hapticService.medium();
                                                        await tribeService.leaveTribe(item.id, user.id);
                                                        hapticService.success();
                                                        // Clear local state immediately for better UX
                                                        if (userTribeId === item.id) {
                                                            setUserTribeId(null);
                                                            setUserTribeName(null);
                                                        }
                                                        await fetchData();
                                                    } catch (error: any) {
                                                        Alert.alert('Error', error.message || 'Failed to leave tribe');
                                                    } finally {
                                                        setIsJoining(null);
                                                    }
                                                }
                                            }
                                        ]
                                    );
                                }}
                                disabled={isJoining !== null}
                            >
                                {isJoining === item.id ? (
                                    <ActivityIndicator size="small" color={theme.error} />
                                ) : (
                                    <Text style={[styles.leaveButtonText, { color: theme.error }]}>Leave Tribe</Text>
                                )}
                            </TouchableOpacity>
                        )
                    ) : (
                        <TouchableOpacity
                            style={[styles.joinButton, { backgroundColor: theme.primary }, (isJoining === item.id || joinedCount >= 2) && { opacity: 0.7 }]}
                            onPress={() => handleJoinTribe(item.id)}
                            disabled={isJoining !== null || joinedCount >= 2}
                        >
                            {isJoining === item.id ? (
                                <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                                <Text style={styles.joinButtonText}>{joinedCount >= 2 ? 'LIMIT REACHED' : 'Join Tribe'}</Text>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <DynamicBackground rotationType="fixed" fixedIndex={5} />
            <LinearGradient
                colors={isDark ? ['transparent', 'transparent'] : ['transparent', 'transparent']}
                style={[styles.screenHeader, { paddingTop: insets.top + 15 }]}
            >
                <View style={styles.headerTop}>
                    <View style={styles.headerContent}>
                        <Text style={[styles.title, { color: theme.text }]}>Explore Tribes</Text>
                        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Connect. Compete. Conquer. Find your Tribe and crush your goals together.</Text>
                    </View>
                    {user && (
                        <TouchableOpacity
                            style={[
                                styles.createButton,
                                { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' },
                                createdCount >= 2 && { opacity: 0.5 }
                            ]}
                            onPress={() => {
                                if (createdCount >= 2) {
                                    Alert.alert('Limit Reached', 'You can only create a maximum of 2 tribes.');
                                    return;
                                }
                                setSubmitError(null);
                                setShowCreateModal(true);
                            }}
                        >
                            <MaterialCommunityIcons name="plus" size={24} color={theme.text} />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={[styles.searchContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                    <MaterialCommunityIcons name="magnify" size={20} color={theme.textSecondary} style={styles.searchIcon} />
                    <TextInput
                        style={[styles.searchInput, { color: theme.text }]}
                        placeholder="Find your tribe..."
                        placeholderTextColor={theme.textMuted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
                    {categories.map(cat => (
                        <TouchableOpacity
                            key={cat}
                            style={[
                                styles.filterChip,
                                { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
                                selectedCategory === cat && { backgroundColor: theme.primary, borderColor: theme.primary }
                            ]}
                            onPress={() => setSelectedCategory(cat)}
                        >
                            <Text style={[
                                styles.filterChipText,
                                { color: theme.textSecondary },
                                selectedCategory === cat && { color: '#FFF', fontWeight: 'bold' }
                            ]}>{cat}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </LinearGradient>

            <FlatList
                data={tribes}
                keyExtractor={(item) => item.id}
                renderItem={renderTribeItem}
                ListHeaderComponent={userTribeId ? (
                    <TouchableOpacity
                        style={[styles.myTribeBanner, { backgroundColor: theme.primary + '10', borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}
                        onPress={() => navigation.navigate('TribeDashboard', { tribeId: userTribeId })}
                    >
                        <LinearGradient colors={[theme.primary, '#2A4B2A']} style={styles.myTribeIcon}>
                            <MaterialCommunityIcons name="crown" size={20} color="#FFF" />
                        </LinearGradient>
                        <View style={styles.myTribeTextContainer}>
                            <Text style={[styles.myTribeTitle, { color: theme.text }]}>{userTribeName || 'My Tribe'}</Text>
                            <Text style={[styles.myTribeSubtitle, { color: theme.textSecondary }]}>View your community updates</Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={24} color={theme.textSecondary} />
                    </TouchableOpacity>
                ) : null}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        {loading ? (
                            <ActivityIndicator size="large" color={theme.primary} />
                        ) : (
                            <>
                                <MaterialCommunityIcons name="account-group-outline" size={64} color={theme.textMuted} />
                                <Text style={[styles.emptyText, { color: theme.textMuted }]}>No Tribes found. Be the first to start one!</Text>
                            </>
                        )}
                    </View>
                }
                contentContainerStyle={[styles.listContent, { paddingBottom: 80 }]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={theme.primary} />}
            />

            <Modal visible={showCreateModal} animationType="slide" transparent={true}>
                <View style={[styles.modalOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.6)' }]}>
                    <View style={[styles.modalContent, { backgroundColor: isDark ? '#1A1525' : theme.backgroundCard }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>Create a Tribe</Text>
                            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                                <MaterialCommunityIcons name="close" size={24} color={theme.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
                            {submitError && (
                                <View style={[styles.errorBanner, { borderLeftColor: theme.error }]}>
                                    <Text style={[styles.errorText, { color: theme.error }]}>{submitError}</Text>
                                </View>
                            )}

                            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Tribe Name</Text>
                            <TextInput
                                style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundInput, borderColor: theme.border }]}
                                placeholder="E.g. Early Birds Fitness"
                                placeholderTextColor={theme.textMuted}
                                value={tribeTitle}
                                onChangeText={setTribeTitle}
                                maxLength={30}
                            />
                            <Text style={{ textAlign: 'right', fontSize: 10, color: theme.textMuted, marginTop: 4 }}>
                                {tribeTitle.length}/30
                            </Text>

                            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Category</Text>
                            <View style={styles.categoryContainer}>
                                {categories.map(cat => (
                                    <TouchableOpacity
                                        key={cat}
                                        style={[styles.categoryChip, { borderColor: theme.border }, tribeCategory === cat && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                                        onPress={() => setTribeCategory(cat)}
                                    >
                                        <Text style={[styles.categoryChipText, { color: theme.textSecondary }, tribeCategory === cat && { color: '#FFF' }]}>{cat}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Experience Level</Text>
                            <View style={styles.categoryContainer}>
                                {['Beginner Friendly', 'All Levels', 'Intermediate', 'Advanced'].map(lvl => (
                                    <TouchableOpacity
                                        key={lvl}
                                        style={[styles.categoryChip, { borderColor: theme.border }, tribeLevel === lvl && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                                        onPress={() => setTribeLevel(lvl)}
                                    >
                                        <Text style={[styles.categoryChipText, { color: theme.textSecondary }, tribeLevel === lvl && { color: '#FFF' }]}>{lvl}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Community Vibe</Text>
                            <View style={styles.categoryContainer}>
                                {['Supportive', 'Competitive', 'Laid-back'].map(vibe => (
                                    <TouchableOpacity
                                        key={vibe}
                                        style={[styles.categoryChip, { borderColor: theme.border }, tribeVibe === vibe && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                                        onPress={() => setTribeVibe(vibe)}
                                    >
                                        <Text style={[styles.categoryChipText, { color: theme.textSecondary }, tribeVibe === vibe && { color: '#FFF' }]}>{vibe}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {gender === 'female' && (
                                <TouchableOpacity
                                    style={{ flexDirection: 'row', alignItems: 'center', marginTop: 20 }}
                                    onPress={() => setIsWomenOnly(!isWomenOnly)}
                                >
                                    <MaterialCommunityIcons
                                        name={isWomenOnly ? "checkbox-marked" : "checkbox-blank-outline"}
                                        size={24}
                                        color={isWomenOnly ? theme.primary : theme.textSecondary}
                                    />
                                    <Text style={{ marginLeft: 10, color: theme.text, fontWeight: '600' }}>Women Only Tribe</Text>
                                    <MaterialCommunityIcons name="gender-female" size={16} color="#F1C93B" style={{ marginLeft: 6 }} />
                                </TouchableOpacity>
                            )}

                            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Description</Text>
                            <TextInput
                                style={[styles.input, styles.textArea, { color: theme.text, backgroundColor: theme.backgroundInput, borderColor: theme.border, height: 80 }]}
                                placeholder="Describe your Tribe's mission..."
                                placeholderTextColor={theme.textMuted}
                                value={tribeDescription}
                                onChangeText={setTribeDescription}
                                multiline
                            />

                            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Rules</Text>
                            <TextInput
                                style={[styles.input, styles.textArea, { color: theme.text, backgroundColor: theme.backgroundInput, borderColor: theme.border, height: 80 }]}
                                placeholder="Set the ground rules for your Tribe..."
                                placeholderTextColor={theme.textMuted}
                                value={tribeRules}
                                onChangeText={setTribeRules}
                                multiline
                            />

                            <View style={{ flexDirection: 'row', gap: 15, marginTop: 20 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.inputLabel, { marginTop: 0, color: theme.textSecondary }]}>Capacity</Text>
                                    <TextInput
                                        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundInput, borderColor: theme.border }]}
                                        placeholder="50"
                                        placeholderTextColor={theme.textMuted}
                                        value={tribeMaxMembers}
                                        onChangeText={setTribeMaxMembers}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.inputLabel, { marginTop: 0, color: theme.textSecondary }]}>Duration (Days)</Text>
                                    <TextInput
                                        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundInput, borderColor: theme.border }]}
                                        placeholder="60"
                                        placeholderTextColor={theme.textMuted}
                                        value={tribeDuration}
                                        onChangeText={setTribeDuration}
                                        keyboardType="numeric"
                                    />
                                </View>
                            </View>

                            <TouchableOpacity
                                style={[styles.submitButton, { backgroundColor: theme.primary }, isCreating && { opacity: 0.7 }]}
                                onPress={() => {
                                    console.log('[TribesScreen] Submit button pressed');
                                    handleCreateTribe();
                                }}
                                disabled={isCreating}
                            >
                                {isCreating ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.submitButtonText}>Create Tribe</Text>
                                )}
                            </TouchableOpacity>
                            <View style={{ height: 20 }} />
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    screenHeader: { paddingHorizontal: 20, paddingBottom: 20 },
    headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
    headerContent: { flex: 1 },
    title: { fontSize: 26, fontWeight: 'bold', letterSpacing: -0.5 },
    subtitle: { fontSize: 13, marginTop: 4, opacity: 0.7 },
    createButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, borderRadius: 15, marginBottom: 20 },
    searchIcon: { marginRight: 10 },
    searchInput: { flex: 1, height: 45, fontSize: 15 },
    categoriesScroll: { marginBottom: 10 },
    filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 10 },
    filterChipText: { fontSize: 13, fontWeight: '600' },
    listContent: { padding: 20 },
    roomCard: { borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1 },
    roomHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
    roomName: { fontSize: 18, fontWeight: 'bold' },
    roomCategory: { fontSize: 12, fontWeight: '600', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },
    memberBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)' },
    memberCount: { fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
    roomDescription: { fontSize: 14, lineHeight: 22, marginBottom: 20, opacity: 0.8 },
    roomFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    activityIndicator: { flexDirection: 'row', alignItems: 'center' },
    activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50', marginRight: 8, shadowColor: '#4CAF50', shadowRadius: 4, shadowOpacity: 0.5 },
    activityText: { fontSize: 12, fontWeight: '500' },
    statusBadge: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12 },
    statusText: { fontSize: 12, fontWeight: 'bold' },
    joinButton: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 12 },
    joinButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 80 },
    emptyText: { fontSize: 16, marginTop: 16, textAlign: 'center' },
    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 25, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    modalTitle: { fontSize: 24, fontWeight: 'bold' },
    modalForm: { marginBottom: 20 },
    errorBanner: { backgroundColor: 'rgba(255,0,0,0.05)', padding: 15, borderRadius: 15, marginBottom: 20, borderLeftWidth: 4 },
    errorText: { fontSize: 14, fontWeight: '600' },
    inputLabel: { fontSize: 14, fontWeight: '600', marginBottom: 10, marginTop: 20, opacity: 0.8 },
    input: { borderRadius: 15, padding: 16, fontSize: 16, borderWidth: 1 },
    categoryContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 5 },
    categoryChip: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
    categoryChipText: { fontSize: 13, fontWeight: '500' },
    textArea: { height: 120, textAlignVertical: 'top' },
    submitButton: { borderRadius: 18, padding: 20, alignItems: 'center', marginTop: 35 },
    submitButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
    myTribeBanner: { marginBottom: 25, borderRadius: 24, padding: 20, flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
    myTribeIcon: { width: 44, height: 44, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
    myTribeTextContainer: { flex: 1, marginLeft: 15 },
    myTribeTitle: { fontSize: 17, fontWeight: 'bold' },
    myTribeSubtitle: { fontSize: 13, marginTop: 2, opacity: 0.6 },
    // New UX Enhancement Badges
    womenOnlyBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center'
    },
    beginnerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        gap: 3
    },
    beginnerText: {
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 0.5
    },
    vibeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        gap: 4
    },
    vibeBadgeText: {
        fontSize: 11,
        fontWeight: '600'
    },
    activityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        gap: 4
    },
    activityBadgeText: {
        fontSize: 11,
        fontWeight: '600'
    },
    leaveButton: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,0,0,0.1)'
    },
    leaveButtonText: {
        fontSize: 12,
        fontWeight: 'bold'
    }
});
