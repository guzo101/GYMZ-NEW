import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Keyboard,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { designSystem } from '../../theme/designSystem';
import * as InstructorService from '../../services/aiChatService';

const SPEECH_GAP = 8;
const SPEECH_WIDTH = 280;
const SPEECH_MIN_HEIGHT = 200;
const SPEECH_MAX_HEIGHT = 280;
const SPEECH_WIDTH_EXPANDED = 312;
const SPEECH_MIN_HEIGHT_EXPANDED = 230;
const SPEECH_MAX_HEIGHT_EXPANDED = 330;
const TAIL_SIZE = 10;
const PADDING_H = 12;
const KEYBOARD_PADDING = 20;

interface BubbleMiniChatProps {
  bubbleLeft: number;
  bubbleTop: number;
  bubbleSize: number;
  screenWidth: number;
  screenHeight: number;
  insets: { top: number; right: number; bottom: number; left: number };
  onClose: () => void;
  onGoToOffice: () => void;
}

interface ChatMsg {
  id: string;
  sender: 'user' | 'ai';
  text: string;
}

export const BubbleMiniChat: React.FC<BubbleMiniChatProps> = ({
  bubbleLeft,
  bubbleTop,
  bubbleSize,
  screenWidth,
  screenHeight,
  insets,
  onClose,
  onGoToOffice,
}) => {
  const { theme, gender } = useTheme();
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Load the same coach conversation as the full Gymz coach (AIChat) screen so this is one continuous chat
  useEffect(() => {
    let isMounted = true;
    if (!user?.id) return;

    const loadSameCoachHistory = async () => {
      try {
        const session = await InstructorService.getSessionIdentifiers(user.id);
        if (!isMounted || !session?.threadId) return;
        const history = await InstructorService.fetchConversations(
          user.id,
          session.threadId,
          'ALL',
          50
        );
        if (!isMounted || !Array.isArray(history)) return;
        // Proper continuity: fetchConversations returns newest-first (index 0 = most recent).
        // FlatList 'inverted' expects index 0 at the bottom.
        // So we keep newest-first so the bottom of the list is always the latest message.
        setMessages(history.slice(0, 50));
      } catch (_) {
        // Keep empty if load fails (e.g. first time user)
      } finally {
        if (isMounted) setHistoryLoaded(true);
      }
    };

    loadSameCoachHistory();
    return () => { isMounted = false; };
  }, [user?.id]);

  const bubbleCenterX = bubbleLeft + bubbleSize / 2;
  const bubbleCenterY = bubbleTop + bubbleSize / 2;
  const isCoachOnRight = bubbleCenterX > screenWidth / 2;
  const chatWidth = isExpanded ? SPEECH_WIDTH_EXPANDED : SPEECH_WIDTH;
  const chatMinHeight = isExpanded ? SPEECH_MIN_HEIGHT_EXPANDED : SPEECH_MIN_HEIGHT;
  const chatMaxHeight = isExpanded ? SPEECH_MAX_HEIGHT_EXPANDED : SPEECH_MAX_HEIGHT;
  const messagesMaxHeight = isExpanded ? 210 : 160;
  const minLeft = insets.left + 8;
  const maxLeft = screenWidth - insets.right - chatWidth - 8;

  let cardLeft: number;
  let tailOnRight: boolean;
  if (isCoachOnRight) {
    cardLeft = Math.max(minLeft, Math.min(maxLeft, bubbleLeft - chatWidth - SPEECH_GAP));
    tailOnRight = true;
  } else {
    cardLeft = Math.max(minLeft, Math.min(maxLeft, bubbleLeft + bubbleSize + SPEECH_GAP));
    tailOnRight = false;
  }

  // Vertical logic: 
  // 1. Center the card vertically on the bubble's center.
  // 2. Adjust for keyboard and screen edges.
  const speechHeight = chatMaxHeight;
  const idealBottomFromBottom = screenHeight - bubbleCenterY - (speechHeight / 2);
  
  // Clamp to avoid bottom/top of screen
  const minBottom = insets.bottom + (keyboardHeight > 0 ? keyboardHeight + 8 : 8);
  const maxBottom = screenHeight - insets.top - speechHeight - 8;
  
  const cardBottomFromScreenBottom = Math.max(minBottom, Math.min(maxBottom, idealBottomFromBottom));

  // Determine tail vertical position relative to the card's top
  // Card layout: Top: screenHeight - cardBottomFromScreenBottom - speechHeight
  // Bubble center: bubbleCenterY
  const cardTop = screenHeight - cardBottomFromScreenBottom - speechHeight;
  const tailTop = Math.max(20, Math.min(speechHeight - 40, bubbleCenterY - cardTop - TAIL_SIZE));

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !user?.id || isSending) return;

    setInput('');
    setMessages((prev) => [{ id: `u-${Date.now()}`, sender: 'user', text }, ...prev]);
    setIsSending(true);

    try {
      const session = await InstructorService.getSessionIdentifiers(user.id);
      await InstructorService.storeMessage(session, 'user', text).catch(() => {});
      const fullContext = await InstructorService.getUserFullContext(user.id);
      if (fullContext?.profile && gender) {
        fullContext.profile.gender = gender;
      }

      // Convert the newest-first messages array to chronological for the AI history context
      const historyToPass = messages
        .slice(0, 6)
        .reverse()
        .map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text
        }));

      const response = await InstructorService.postToAI(session, text, fullContext, 'coach', historyToPass);

      if (response?.reply) {
        const reply = response.reply.trim();
        setMessages((prev) => [{ id: `ai-${Date.now()}`, sender: 'ai', text: reply }, ...prev]);
        await InstructorService.storeMessage(session, 'ai', reply).catch(() => {});
      }
    } catch (e) {
      setMessages((prev) => [
        {
          id: `ai-err-${Date.now()}`,
          sender: 'ai',
          text: "Something went wrong. Tap the coach again or open full chat.",
        },
        ...prev,
      ]);
    } finally {
      setIsSending(false);
    }
  }, [input, user?.id, isSending, onGoToOffice, onClose, messages, gender]);

  return (
    <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.35)' }]}>
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      <View
        style={[
          styles.speechCard,
          {
            position: 'absolute',
            left: cardLeft,
            bottom: cardBottomFromScreenBottom,
            width: chatWidth,
            minHeight: chatMinHeight,
            maxHeight: speechHeight,
            backgroundColor: 'transparent',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.2,
            shadowRadius: 20,
            elevation: 20,
          },
        ]}
      >
        <BlurView
          intensity={80}
          tint="light"
          style={[StyleSheet.absoluteFill, { borderRadius: 24, overflow: 'hidden', backgroundColor: 'rgba(255, 255, 255, 0.85)' }]}
        />
        <View style={[styles.header, { borderBottomColor: theme.border + '66' }]}>
          <Text style={[styles.title, { color: theme.text }]}>Coach</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => setIsExpanded((prev) => !prev)}
              hitSlop={12}
              style={styles.iconBtn}
            >
              <MaterialCommunityIcons
                name={isExpanded ? 'arrow-collapse' : 'arrow-expand'}
                size={18}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>
        <FlatList
          style={[styles.messagesWrap, { maxHeight: messagesMaxHeight }]}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
          inverted
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item: m, index }) => {
            const isUser = m.sender === 'user';
            const prevItem = messages[index + 1];
            const nextItem = messages[index - 1];

            const isFirstInGroup = !prevItem || prevItem.sender !== m.sender;
            const isLastInGroup = !nextItem || nextItem.sender !== m.sender;

            const radius = 22;
            const smallRadius = 10;

            const bubbleRadius = {
              borderTopLeftRadius: isUser ? radius : (isFirstInGroup ? radius : smallRadius),
              borderBottomLeftRadius: isUser ? radius : (isLastInGroup ? radius : smallRadius),
              borderTopRightRadius: isUser ? (isFirstInGroup ? radius : smallRadius) : radius,
              borderBottomRightRadius: isUser ? (isLastInGroup ? radius : smallRadius) : radius,
            };

            const aiColor = gender === 'female' ? designSystem.colors.female.light.primary : designSystem.colors.male.light.primary;

            return (
              <View style={[styles.bubbleWrap, isUser ? styles.rowUser : styles.rowAi]}>
                <View
                  style={[
                    styles.bubble,
                    bubbleRadius,
                    { overflow: 'hidden' },
                    !isUser && {
                      borderWidth: 1,
                      borderColor: aiColor + '40',
                      shadowColor: aiColor,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.3,
                      shadowRadius: 12,
                    }
                  ]}
                >
                  <BlurView
                    intensity={isUser ? 30 : 55}
                    tint="light"
                    style={[StyleSheet.absoluteFill, { backgroundColor: isUser ? 'rgba(230, 235, 240, 0.7)' : 'rgba(255, 255, 255, 0.85)' }]}
                  />
                  <Text
                    style={[
                      styles.bubbleText,
                      { color: '#1B2E1B' },
                    ]}
                  >
                    {m.text}
                  </Text>
                </View>
              </View>
            );
          }}
          ListHeaderComponent={isSending ? (
            <View style={styles.rowAi}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={[styles.thinking, { color: theme.textMuted }]}>Thinking...</Text>
            </View>
          ) : null}
          ListFooterComponent={
            <>
              {!historyLoaded && messages.length === 0 && (
                <View style={styles.rowAi}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <Text style={[styles.thinking, { color: theme.textMuted }]}>Loading your coach chat...</Text>
                </View>
              )}
              {historyLoaded && messages.length === 0 && !isSending && (
                <Text style={[styles.placeholder, { color: theme.textMuted }]}>
                  Ask your coach anything. Same chat as the full coach screen—short replies stay here.
                </Text>
              )}
            </>
          }
        />
        <View style={[styles.footer, { borderTopColor: 'rgba(0,0,0,0.08)' }]}>
          <View style={[styles.inputWrapper, { backgroundColor: 'rgba(0,0,0,0.05)' }]}>
            <TextInput
              style={[
                styles.input,
                {
                  color: '#1B2E1B',
                },
              ]}
              placeholder="Type to Coach..."
              placeholderTextColor="rgba(27, 46, 27, 0.4)"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              editable={!isSending}
            />
          </View>
          <TouchableOpacity
            onPress={handleSend}
            disabled={!input.trim() || isSending}
            style={[
              styles.sendBtn,
              { backgroundColor: input.trim() && !isSending ? '#1B2E1B' : 'rgba(0,0,0,0.08)' },
            ]}
          >
            <MaterialCommunityIcons
              name="arrow-up"
              size={18}
              color={input.trim() && !isSending ? '#fff' : 'rgba(27, 46, 27, 0.4)'}
            />
          </TouchableOpacity>
        </View>
        {tailOnRight ? (
          <View
            style={[
              styles.tailRight,
              {
                top: tailTop,
                borderLeftColor: 'rgba(255, 255, 255, 0.92)',
                borderTopColor: 'transparent',
                borderBottomColor: 'transparent',
              },
            ]}
          />
        ) : (
          <View
            style={[
              styles.tailLeft,
              {
                top: tailTop,
                borderRightColor: 'rgba(255, 255, 255, 0.92)',
                borderTopColor: 'transparent',
                borderBottomColor: 'transparent',
              },
            ]}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
  },
  speechCard: {
    borderRadius: 20,
    overflow: 'visible',
  },
  tailRight: {
    position: 'absolute',
    right: -TAIL_SIZE,
    top: SPEECH_MIN_HEIGHT / 2 - TAIL_SIZE,
    width: 0,
    height: 0,
    borderLeftWidth: TAIL_SIZE,
    borderTopWidth: TAIL_SIZE,
    borderBottomWidth: TAIL_SIZE,
  },
  tailLeft: {
    position: 'absolute',
    left: -TAIL_SIZE,
    top: SPEECH_MIN_HEIGHT / 2 - TAIL_SIZE,
    width: 0,
    height: 0,
    borderRightWidth: TAIL_SIZE,
    borderTopWidth: TAIL_SIZE,
    borderBottomWidth: TAIL_SIZE,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PADDING_H,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  iconBtn: {
    padding: 4,
  },
  messagesWrap: {
    flex: 1,
    maxHeight: 160,
  },
  messagesContent: {
    paddingHorizontal: PADDING_H,
    paddingVertical: 8,
  },
  placeholder: {
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 16,
  },
  bubbleWrap: {
    width: '100%',
    marginBottom: 6,
  },
  rowUser: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 6,
  },
  rowAi: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 6,
  },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  bubbleUser: {
    borderBottomRightRadius: 4,
  },
  bubbleAi: {
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 13.5,
    lineHeight: 18,
  },
  thinking: {
    fontSize: 12,
    marginLeft: 6,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 6,
    borderTopWidth: 1,
  },
  inputWrapper: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    height: 40,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
