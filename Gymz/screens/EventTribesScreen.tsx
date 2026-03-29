import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { DataMapper } from '../utils/dataMapper';

interface CommunityChannel {
    id: string;
    name: string;
    description: string;
    iconName: string;
    lastMessage?: string;
    participantCount?: number;
}

export default function EventTribesScreen({ navigation }: any) {
    const { user } = useAuth();
    const [channels, setChannels] = useState<CommunityChannel[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchChannels = useCallback(async () => {
        if (!user?.gymId) return;
        try {
            // Fetch community channels for this gym
            const { data, error } = await (supabase as any)
                .from('community_channels')
                .select('*')
                .eq('gym_id', user.gymId)
                .eq('is_active', true)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setChannels(DataMapper.fromDb(data) || []);
        } catch (err) {
            console.error('[EventTribes] Fetch error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user?.gymId]);

    useEffect(() => {
        fetchChannels();
    }, [fetchChannels]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchChannels();
    };

    const renderItem = ({ item }: { item: CommunityChannel }) => (
        <TouchableOpacity
            style={styles.roomCard}
            onPress={() => navigation.navigate('EventChat', { channelId: item.id, channelName: item.name })}
        >
            <View style={[styles.iconBox, { backgroundColor: 'rgba(168,85,247,0.1)' }]}>
                <MaterialCommunityIcons name={(item.iconName as any) || 'forum-outline'} size={24} color="#a855f7" />
            </View>
            <View style={styles.cardContent}>
                <Text style={styles.roomName}>{item.name}</Text>
                <Text style={styles.roomDesc} numberOfLines={2}>{item.description}</Text>
                <View style={styles.roomFooter}>
                    <View style={styles.pills}>
                        <View style={styles.pill}>
                            <MaterialCommunityIcons name="account-group" size={10} color="rgba(255,255,255,0.4)" />
                            <Text style={styles.pillText}>{item.participantCount || 0} participants</Text>
                        </View>
                    </View>
                </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="rgba(255,255,255,0.2)" />
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#0A120A', '#1B241B', '#080F08']} style={StyleSheet.absoluteFill} pointerEvents="none" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Community Tribes</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.heroSection}>
                <MaterialCommunityIcons name="forum-outline" size={48} color="#a855f7" style={styles.heroIcon} />
                <Text style={styles.heroTitle}>Connect with your community</Text>
                <Text style={styles.heroSubtitle}>Join discussions about events, training, and more.</Text>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#a855f7" />
                </View>
            ) : (
                <FlatList
                    data={channels}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#a855f7" />}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="comment-off-outline" size={64} color="rgba(255,255,255,0.1)" />
                            <Text style={styles.emptyTitle}>No tribes available yet</Text>
                            <Text style={styles.emptySubtitle}>Check back later!</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050B05' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 10,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
    heroSection: { alignItems: 'center', padding: 30, textAlign: 'center' },
    heroIcon: { marginBottom: 16, opacity: 0.8 },
    heroTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    heroSubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', lineHeight: 20 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
    roomCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 20, padding: 18, gap: 16,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    },
    iconBox: {
        width: 52, height: 52, borderRadius: 16,
        justifyContent: 'center', alignItems: 'center',
    },
    cardContent: { flex: 1 },
    roomName: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
    roomDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 13, lineHeight: 18, marginBottom: 12 },
    roomFooter: { flexDirection: 'row', alignItems: 'center' },
    pills: { flexDirection: 'row', gap: 8 },
    pill: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    },
    pillText: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '500' },
    emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 50, gap: 12 },
    emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
    emptySubtitle: { color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
});
