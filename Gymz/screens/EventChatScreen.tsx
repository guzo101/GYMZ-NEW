import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    RefreshControl,
    Image,
    Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { format } from 'date-fns';
import { DataMapper } from '../utils/dataMapper';

interface Message {
    id: string;
    userId: string;
    content: string;
    createdAt: string;
    senderType: string;
    replyTo?: string;
    user?: {
        name: string;
        avatarUrl: string | null;
        role: string;
    };
}

export default function EventChatScreen({ route, navigation }: any) {
    const { channelId, channelName } = route.params;
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);

    const fetchMessages = useCallback(async () => {
        try {
            const { data, error } = await (supabase as any)
                .from('channel_messages')
                .select('*, user:users(name, avatar_url, role)')
                .eq('channel_id', channelId)
                .order('created_at', { ascending: true })
                .limit(100);

            if (error) throw error;
            setMessages(DataMapper.fromDb<Message[]>(data || []));
        } catch (err) {
            console.error('[EventChat] Fetch error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [channelId]);

    useEffect(() => {
        fetchMessages();

        // Set up real-time subscription
        const channel = (supabase as any)
            .channel(`channel-${channelId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'channel_messages',
                filter: `channel_id=eq.${channelId}`
            }, (payload: any) => {
                // Optimistic refresh would be better, but for now just refetch user data too
                fetchMessages();
            })
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [channelId, fetchMessages]);

    const handleSend = async () => {
        if (!inputText.trim() || sending) return;
        setSending(true);
        const content = inputText.trim();
        setInputText('');
        Keyboard.dismiss();

        try {
            const { error } = await (supabase as any)
                .from('channel_messages')
                .insert({
                    channel_id: channelId,
                    user_id: user?.id,
                    content,
                    sender_type: user?.role === 'admin' ? 'admin' : 'user'
                });

            if (error) throw error;
            fetchMessages();
        } catch (err) {
            console.error('[EventChat] Send error:', err);
        } finally {
            setSending(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchMessages();
    };

    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        }
    }, [messages]);

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#0A120A', '#1B241B', '#080F08']} style={StyleSheet.absoluteFill} pointerEvents="none" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>{channelName}</Text>
                    <Text style={styles.headerStatus}>Community Channel</Text>
                </View>
                <TouchableOpacity style={styles.infoBtn}>
                    <MaterialCommunityIcons name="information-outline" size={22} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.chatScroll}
                    contentContainerStyle={styles.chatContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4CAF50" />}
                >
                    {loading ? (
                        <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 20 }} />
                    ) : messages.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>Be the first to say hello!</Text>
                        </View>
                    ) : (
                        messages.map((msg, index) => {
                            const isMine = msg.userId === user?.id;
                            const isNextSameUser = index < messages.length - 1 && messages[index + 1].userId === msg.userId;

                            return (
                                <View key={msg.id} style={[styles.messageRow, isMine && styles.myMessageRow]}>
                                    {!isMine && !isNextSameUser && (
                                        <View style={styles.avatarContainer}>
                                            {msg.user?.avatarUrl ? (
                                                <Image source={{ uri: msg.user.avatarUrl }} style={styles.avatar} />
                                            ) : (
                                                <View style={styles.avatarPlaceholder}>
                                                    <Text style={styles.avatarText}>{msg.user?.name?.charAt(0)}</Text>
                                                </View>
                                            )}
                                        </View>
                                    )}
                                    {!isMine && isNextSameUser && <View style={styles.avatarContainer} />}

                                    <View style={[styles.bubbleWrapper, isMine && styles.myBubbleWrapper]}>
                                        {!isMine && !isNextSameUser && (
                                            <Text style={styles.senderName}>{msg.user?.name}</Text>
                                        )}
                                        <View style={[styles.bubble, isMine ? styles.myBubble : styles.otherBubble]}>
                                            <Text style={[styles.messageText, isMine && styles.myMessageText]}>{msg.content}</Text>
                                            <Text style={[styles.messageTime, isMine && styles.myMessageTime]}>
                                                {format(new Date(msg.createdAt), 'HH:mm')}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </ScrollView>

                {/* Input area */}
                <View style={styles.inputArea}>
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Message..."
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            value={inputText}
                            onChangeText={setInputText}
                            multiline
                        />
                        <TouchableOpacity
                            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
                            onPress={handleSend}
                            disabled={!inputText.trim() || sending}
                        >
                            {sending ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <MaterialCommunityIcons name="send" size={20} color="#fff" />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#050B05' },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 15,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerInfo: { flex: 1, marginLeft: 10 },
    headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
    headerStatus: { color: '#4CAF50', fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
    infoBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    chatScroll: { flex: 1 },
    chatContent: { padding: 20, paddingBottom: 40 },
    messageRow: { flexDirection: 'row', marginBottom: 10, alignItems: 'flex-end', gap: 10 },
    myMessageRow: { flexDirection: 'row-reverse' },
    avatarContainer: { width: 32, height: 32 },
    avatar: { width: 32, height: 32, borderRadius: 16 },
    avatarPlaceholder: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: '#2A4B2A', justifyContent: 'center', alignItems: 'center'
    },
    avatarText: { color: '#fff', fontSize: 12, fontWeight: '800' },
    bubbleWrapper: { maxWidth: '80%' },
    myBubbleWrapper: { alignItems: 'flex-end' },
    senderName: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 4, marginLeft: 4 },
    bubble: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18 },
    myBubble: { backgroundColor: '#4CAF50', borderBottomRightRadius: 4 },
    otherBubble: { backgroundColor: 'rgba(255,255,255,0.08)', borderBottomLeftRadius: 4 },
    messageText: { color: '#fff', fontSize: 15, lineHeight: 21 },
    myMessageText: { color: '#fff' },
    messageTime: {
        color: 'rgba(255,255,255,0.3)', fontSize: 9,
        alignSelf: 'flex-end', marginTop: 4
    },
    myMessageTime: { color: 'rgba(255,255,255,0.6)' },
    emptyState: { alignItems: 'center', paddingVertical: 100 },
    emptyText: { color: 'rgba(255,255,255,0.2)', fontSize: 14, fontStyle: 'italic' },
    inputArea: {
        paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 20, paddingTop: 10,
        backgroundColor: '#0A120A', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
    },
    inputContainer: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 24, paddingLeft: 16, paddingRight: 6, paddingVertical: 6,
    },
    input: { flex: 1, color: '#fff', fontSize: 15, maxHeight: 100, paddingVertical: 8 },
    sendBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center',
    },
    sendBtnDisabled: { opacity: 0.3 },
});
