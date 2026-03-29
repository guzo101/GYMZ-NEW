import React, { useEffect, useState, useRef } from 'react';
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
  Dimensions,
  Image,
  Alert,
  Keyboard,
  Modal,
  Pressable,
  LayoutAnimation,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../services/supabase';
import { format } from 'date-fns';
import { sendMessageToWebhookImmediately } from '../services/aiChat';
import { ScreenHeader } from '../components/ScreenHeader';
import { DataMapper } from '../utils/dataMapper';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { decode } from 'base64-arraybuffer';

const { width } = Dimensions.get('window');
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

interface Reaction {
  id: string;
  userId: string;
  emoji: string;
}

interface ChatMessage {
  id: string;
  userId: string;
  content: string;
  imageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  senderType?: 'user' | 'admin' | 'ai' | 'admin_assist';
  replyTo?: string | null;
  user?: {
    name: string;
    email: string;
    role: string;
    avatarUrl?: string | null;
  } | null;
  replies?: ChatMessage[];
  reactions?: Reaction[];
}

export default function CommunityChatScreen({ navigation }: any) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [userMemory, setUserMemory] = useState<any>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [reactionModalMsg, setReactionModalMsg] = useState<ChatMessage | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchMessages();
    fetchUserMemory(); // Pull personalization hooks
    const subscribe = subscribeToChanges();
    return () => {
      subscribe?.unsubscribe();
    };
  }, [user?.id, user?.gymId]);

  const fetchMessages = async () => {
    if (!user?.gymId) {
      setMessages([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      // Fetch latest 50 parent messages for this gym only (everyone under the gym)
      let parentQuery = (supabase as any)
        .from('notice_board')
        .select('*')
        .is('reply_to', null)
        .or(`gym_id.eq.${user.gymId},gym_id.is.null`)
        .order('created_at', { ascending: false })
        .limit(50);

      const { data: parents, error: parentError } = await parentQuery;

      if (parentError) throw parentError;

      const parentIds = (parents || []).map((p: any) => p.id);
      let allReplies: any[] = [];

      if (parentIds.length > 0) {
        const { data: replies, error: replyError } = await (supabase as any)
          .from('notice_board')
          .select('*')
          .in('reply_to', parentIds)
          .order('created_at', { ascending: true });

        if (replyError) throw replyError;
        allReplies = replies || [];
      }

      const allFetched = DataMapper.fromDb<any[]>([...parents, ...allReplies]);

      // Fetch user details for each unique user_id
      const uniqueUserIds = Array.from(new Set(allFetched.map(m => m.userId)));
      const { data: userData } = await (supabase as any)
        .from('users')
        .select('id, name, email, role, avatar_url')
        .in('id', uniqueUserIds);

      const userMap = new Map(DataMapper.fromDb<any[]>(userData || []).map((u: any) => [u.id, u]));

      const allIds = allFetched.map((m: any) => m.id);
      let reactionsMap: Record<string, Reaction[]> = {};
      if (allIds.length > 0) {
        const { data: reactionsData } = await (supabase as any)
          .from('notice_board_reactions')
          .select('*')
          .in('message_id', allIds);
        const reactions = DataMapper.fromDb<any[]>(reactionsData || []);
        reactions.forEach((r: any) => {
          if (!reactionsMap[r.messageId]) reactionsMap[r.messageId] = [];
          reactionsMap[r.messageId].push({ id: r.id, userId: r.userId, emoji: r.emoji });
        });
      }

      const messagesWithUsers = allFetched.map((m: any) => ({
        ...m,
        user: m.senderType === 'ai' || m.senderType === 'admin_assist' ? null : userMap.get(m.userId),
        replies: [],
        reactions: reactionsMap[m.id] || []
      }));

      // Organize into threads
      const organized = messagesWithUsers
        .filter(m => !m.replyTo)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) // Oldest at top for scroll container
        .map(parent => ({
          ...parent,
          replies: messagesWithUsers
            .filter(r => r.replyTo === parent.id)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        }));

      setMessages(organized);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchUserMemory = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await (supabase as any)
        .from('user_ai_memory')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data) {
        console.log('[CommunityChat] User memory context fetched');
        setUserMemory(DataMapper.fromDb(data));
      }
    } catch (e) {
      console.log('[CommunityChat] Memory fetch missed:', e);
    }
  };

  const subscribeToChanges = () => {
    return (supabase as any)
      .channel('community-chat')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notice_board' }, () => fetchMessages())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notice_board_reactions' }, () => fetchMessages())
      .subscribe();
  };

  const uploadImage = async (base64: string): Promise<string> => {
    const arrayBuffer = decode(base64);
    const ext = 'jpg';
    const mimeType = 'image/jpeg';
    const filePath = `chat_${user?.id}_${Date.now()}.${ext}`;
    const bucket = 'community-chat';
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, arrayBuffer, { contentType: mimeType, upsert: false });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return publicUrl;
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission', 'We need camera roll access to share photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setImageBase64(asset.base64 || null);
    }
  };

  const handleReaction = async (msg: ChatMessage, emoji: string) => {
    if (!user?.id) return;
    setReactionModalMsg(null);
    try {
      const existing = msg.reactions?.find((r) => r.userId === user.id);
      if (existing) {
        if (existing.emoji === emoji) {
          await (supabase as any).from('notice_board_reactions').delete().eq('id', existing.id);
        } else {
          await (supabase as any).from('notice_board_reactions').update({ emoji }).eq('id', existing.id);
        }
      } else {
        await (supabase as any).from('notice_board_reactions').insert({
          user_id: user.id,
          message_id: msg.id,
          emoji,
        });
      }
      fetchMessages();
    } catch (e) {
      console.warn('[CommunityChat] Reaction failed:', e);
    }
  };

  const handleSend = async () => {
    if ((!inputText.trim() && !imageUri) || !user?.id) return;
    if (imageUri && !imageBase64) {
      Alert.alert('Error', 'Could not load image. Please try again.');
      return;
    }

    const content = inputText.trim() || '';
    const base64ToSend = imageBase64;
    setInputText('');
    setImageUri(null);
    setImageBase64(null);
    setReplyingTo(null);
    setEditingMessage(null);
    setSending(true);
    Keyboard.dismiss();

    try {
      let imageUrl: string | null = null;
      if (base64ToSend) {
        imageUrl = await uploadImage(base64ToSend);
      }

      const senderType = isAdmin ? 'admin' : 'user';
      const { data: inserted, error } = await (supabase as any)
        .from('notice_board')
        .insert(DataMapper.toDb({
          userId: user.id,
          content: content || '',
          imageUrl: imageUrl || undefined,
          senderType,
          replyTo: replyingTo?.id || null,
        }))
        .select()
        .single();

      if (error) {
        console.error('[CommunityChat] Supabase insert error:', error);
        throw error;
      }

      if (inserted) {
        const appInserted = DataMapper.fromDb<any>(inserted);
        if (senderType === 'user' && content) {
          sendMessageToWebhookImmediately(
            appInserted.id,
            user.id,
            content,
            'user',
            appInserted.createdAt,
            {
              personality: userMemory?.personalityType,
              goal: userMemory?.primaryGoal,
              communicationStyle: userMemory?.communicationStyle
            }
          );
        }
        fetchMessages();
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      Alert.alert('Error', error.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Message', 'Are you sure you want to delete this message?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await (supabase as any).from('notice_board').delete().eq('id', id);
          if (error) Alert.alert('Error', 'Failed to delete message');
          else fetchMessages();
        }
      }
    ]);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchMessages();
  };

  useEffect(() => {
    if (!loading) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages, loading]);

  const swipeableRefs = useRef<Map<string, Swipeable | null>>(new Map());

  const triggerReply = (msg: ChatMessage) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReplyingTo(msg);
    swipeableRefs.current.get(msg.id)?.close();
  };

  const renderReplyAction = (msg: ChatMessage, theme: any) => (
    <TouchableOpacity
      style={styles.swipeActionIcon}
      onPress={() => triggerReply(msg)}
      activeOpacity={0.7}
    >
      <MaterialCommunityIcons name="reply" size={24} color={theme.primary} />
    </TouchableOpacity>
  );

  const renderMessage = (msg: ChatMessage, isReply = false, parentMsg?: ChatMessage, prevMsg?: ChatMessage) => {
    const isMine = msg.userId === user?.id;
    const isAI = msg.senderType === 'ai' || msg.senderType === 'admin_assist';
    const senderName = isAI ? 'Admin Assistant' : (msg.user?.name || 'Unknown');
    const isConsecutiveFromSame = prevMsg && prevMsg.userId === msg.userId;

    const myBubbleColor = '#D9FDD3';
    const aiBubbleBg = `${theme.primary}18`;
    const aiBubbleBorder = `${theme.primary}40`;
    const otherBubbleBg = theme.backgroundCard;
    const otherBubbleBorder = theme.border;

    const rowContent = (
      <View>
        <Pressable
          style={({ pressed }) => [
            styles.bubblePressable,
            isMine && styles.bubblePressableMine,
            pressed && styles.bubblePressed,
          ]}
          onLongPress={() => setReactionModalMsg(msg)}
          delayLongPress={400}
        >
          <View style={[
            styles.messageBubble,
            isMine
              ? { backgroundColor: myBubbleColor, borderBottomRightRadius: 4 }
              : isAI
                ? { backgroundColor: aiBubbleBg, borderWidth: 1, borderColor: aiBubbleBorder, borderBottomLeftRadius: 4 }
                : { backgroundColor: otherBubbleBg, borderWidth: 1, borderColor: otherBubbleBorder, borderBottomLeftRadius: 4 },
            isReply && styles.replyBubble,
          ]}>
            {!isReply && !isConsecutiveFromSame && (
              <Text style={[
                styles.senderName,
                { color: isMine ? 'rgba(0,0,0,0.6)' : theme.textSecondary }
              ]} numberOfLines={1}>
                {senderName}
                {msg.senderType === 'admin' && ' • Admin'}
              </Text>
            )}
            {msg.replyTo && parentMsg && (
              <View style={[styles.quotedMsg, { borderLeftColor: theme.primary }]}>
                <Text style={[styles.quotedSender, { color: theme.primary }]}>
                  {parentMsg.user?.name || 'Admin Assistant'}
                </Text>
                <Text style={[styles.quotedText, { color: theme.textSecondary }]} numberOfLines={2}>
                  {parentMsg.content?.trim() || '📷 Photo'}
                </Text>
              </View>
            )}
            {msg.imageUrl ? (
              <Image source={{ uri: msg.imageUrl }} style={styles.messageImage} resizeMode="cover" />
            ) : null}
            {msg.content?.trim() ? (
              <Text style={[styles.messageText, { color: isMine ? '#111' : theme.text }]}>
                {msg.content}
              </Text>
            ) : null}
            <View style={styles.bubbleFooter}>
              {msg.reactions && msg.reactions.length > 0 && (
                <View style={[styles.reactionsPill, { backgroundColor: isMine ? 'rgba(0,0,0,0.06)' : theme.backgroundInput }]}>
                  {Array.from(new Set(msg.reactions.map((r) => r.emoji))).map((emoji) => (
                    <Text key={emoji} style={styles.reactionEmoji}>{emoji}</Text>
                  ))}
                </View>
              )}
              <Text style={[styles.messageTime, { color: theme.textMuted }]}>
                {format(new Date(msg.createdAt), 'h:mm a')}
              </Text>
            </View>
          </View>
        </Pressable>

        {!isReply && msg.replies && msg.replies.length > 0 && (
          <View style={styles.repliesContainer}>
            {msg.replies.map((reply, ri) => renderMessage(reply, true, msg, msg.replies?.[ri - 1]))}
          </View>
        )}
      </View>
    );

    const rowStyles = [
      styles.messageRow,
      isMine && styles.myMessageRow,
      isConsecutiveFromSame && styles.consecutiveRow,
    ];

    if (isReply) {
      return (
        <View key={msg.id} style={[...rowStyles, styles.replyRow]}>
          {rowContent}
        </View>
      );
    }

    return (
      <View key={msg.id} style={rowStyles}>
        <Swipeable
          ref={(r) => { if (r) swipeableRefs.current.set(msg.id, r); }}
          renderLeftActions={() => renderReplyAction(msg, theme)}
          onSwipeableLeftOpen={() => triggerReply(msg)}
          friction={1}
          overshootFriction={8}
          leftThreshold={40}
        >
          {rowContent}
        </Swipeable>
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
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScreenHeader
        title="Community Chat"
        rightElement={
          <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
            <MaterialCommunityIcons name="refresh" size={24} color={theme.primary} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        ref={scrollViewRef}
        style={styles.chatContainer}
        contentContainerStyle={styles.chatContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconBox, { backgroundColor: theme.backgroundCard }]}>
              <MaterialCommunityIcons name="message-text-outline" size={48} color={theme.textMuted} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No messages yet</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>Start the conversation with the community!</Text>
          </View>
        ) : (
          messages.map((msg, i) => renderMessage(msg, false, undefined, messages[i - 1]))
        )}
      </ScrollView>

      {/* Reply preview bar (WhatsApp-style) */}
      {replyingTo && (
        <View style={[styles.replyBar, { backgroundColor: theme.backgroundInput, borderLeftColor: theme.primary }]}>
          <View style={styles.replyBarContent}>
            <MaterialCommunityIcons name="reply" size={18} color={theme.primary} />
            <View style={styles.replyBarText}>
              <Text style={[styles.replyBarName, { color: theme.text }]}>
                {replyingTo.user?.name || 'Admin Assistant'}
              </Text>
              <Text style={[styles.replyBarPreview, { color: theme.textMuted }]} numberOfLines={1}>
                {replyingTo.content?.trim() || '📷 Photo'}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setReplyingTo(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialCommunityIcons name="close" size={22} color={theme.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.inputWrapper, { borderTopColor: theme.border }]}>
        {imageUri ? (
          <View style={styles.imagePreviewRow}>
            <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
            <TouchableOpacity onPress={() => { setImageUri(null); setImageBase64(null); }} style={styles.removeImageBtn}>
              <MaterialCommunityIcons name="close-circle" size={24} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
        ) : null}
        <View style={[styles.inputInner, { backgroundColor: theme.backgroundInput }]}>
          <TouchableOpacity onPress={pickImage} style={styles.attachBtn}>
            <MaterialCommunityIcons name="image-plus" size={24} color={theme.primary} />
          </TouchableOpacity>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="Message..."
            placeholderTextColor={theme.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: theme.primary }, ((!inputText.trim() && !imageUri) || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={(!inputText.trim() && !imageUri) || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <MaterialCommunityIcons name="send" size={20} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Long-press action menu (WhatsApp-style) */}
      <Modal visible={!!reactionModalMsg} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setReactionModalMsg(null)}>
          <View style={[styles.actionMenu, { backgroundColor: theme.backgroundCard }]}>
            <TouchableOpacity
              style={styles.actionMenuItem}
              onPress={() => {
                if (reactionModalMsg) setReplyingTo(reactionModalMsg);
                setReactionModalMsg(null);
              }}
            >
              <MaterialCommunityIcons name="reply" size={22} color={theme.text} />
              <Text style={[styles.actionMenuLabel, { color: theme.text }]}>Reply</Text>
            </TouchableOpacity>
            <View style={[styles.actionMenuDivider, { backgroundColor: theme.border }]} />
            <View style={styles.reactionRow}>
              {REACTION_EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.reactionBtn}
                  onPress={() => reactionModalMsg && handleReaction(reactionModalMsg, emoji)}
                >
                  <Text style={styles.reactionBtnEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {(reactionModalMsg && (reactionModalMsg.userId === user?.id || isAdmin)) && (
              <>
                <View style={[styles.actionMenuDivider, { backgroundColor: theme.border }]} />
                <TouchableOpacity
                  style={styles.actionMenuItem}
                  onPress={() => {
                    reactionModalMsg && handleDelete(reactionModalMsg.id);
                    setReactionModalMsg(null);
                  }}
                >
                  <MaterialCommunityIcons name="delete-outline" size={22} color="#EF4444" />
                  <Text style={[styles.actionMenuLabel, { color: '#EF4444' }]}>Delete</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const BUBBLE_MAX = Math.min(width * 0.82, 260);
const styles = StyleSheet.create({
  container: { flex: 1 },
  refreshBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  chatContainer: { flex: 1 },
  chatContent: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 24 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messageRow: { marginBottom: 2, maxWidth: BUBBLE_MAX, alignSelf: 'flex-start' },
  consecutiveRow: { marginTop: -1 },
  myMessageRow: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubblePressable: { borderRadius: 16, alignSelf: 'flex-start' },
  bubblePressableMine: { alignSelf: 'flex-end' },
  bubblePressed: { opacity: 0.92 },
  messageBubble: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    maxWidth: BUBBLE_MAX,
    alignSelf: 'flex-start',
  },
  senderName: { fontSize: 10, fontWeight: '600', marginBottom: 1, opacity: 0.85 },
  quotedMsg: {
    borderLeftWidth: 2,
    paddingLeft: 6,
    marginBottom: 3,
    marginTop: 1,
  },
  quotedSender: { fontSize: 10, fontWeight: '600', marginBottom: 0 },
  quotedText: { fontSize: 11, opacity: 0.85 },
  messageText: { fontSize: 14, lineHeight: 18 },
  messageImage: {
    width: Math.min(width * 0.6, 200),
    height: 140,
    borderRadius: 8,
    marginVertical: 2,
  },
  bubbleFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2 },
  reactionsPill: { flexDirection: 'row', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, gap: 1 },
  reactionEmoji: { fontSize: 12 },
  messageTime: { fontSize: 10, opacity: 0.8 },
  replyRow: { marginLeft: 10, marginTop: 1 },
  replyBubble: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, borderBottomLeftRadius: 4 },
  repliesContainer: { marginTop: 2 },
  inputWrapper: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  imagePreviewRow: { flexDirection: 'row', marginBottom: 8, alignItems: 'center', gap: 8 },
  imagePreview: { width: 56, height: 56, borderRadius: 12 },
  removeImageBtn: { padding: 4 },
  inputInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 24,
    paddingLeft: 4,
    paddingRight: 4,
    paddingVertical: 6,
    minHeight: 44,
  },
  attachBtn: { padding: 10, marginRight: 2 },
  input: {
    flex: 1,
    fontSize: 16,
    maxHeight: 120,
    paddingVertical: 10,
    paddingHorizontal: 4,
    ...Platform.select({ web: { outlineStyle: 'none' } as any }),
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderLeftWidth: 4,
  },
  replyBarContent: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  replyBarText: { flex: 1 },
  replyBarName: { fontSize: 14, fontWeight: '600' },
  replyBarPreview: { fontSize: 13, marginTop: 1 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyIconBox: { width: 88, height: 88, borderRadius: 44, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', paddingHorizontal: 32, opacity: 0.8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  actionMenu: {
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 4,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  actionMenuLabel: { fontSize: 16, fontWeight: '500' },
  actionMenuDivider: { height: 1, marginVertical: 4 },
  reactionRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8, paddingHorizontal: 4 },
  reactionBtn: { padding: 8 },
  reactionBtnEmoji: { fontSize: 26 },
  swipeActionIcon: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 56,
  },
});
