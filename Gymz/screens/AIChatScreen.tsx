import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Keyboard,
  Platform,
  FlatList,
  ActivityIndicator,
  Alert,
  StatusBar,
  Animated
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { BlurView } from 'expo-blur';
import * as InstructorService from '../services/aiChatService';
import { OverdueStatusModal } from '../components/membership/OverdueStatusModal';
import { FeatureLimitModal } from '../components/membership/FeatureLimitModal';
import { ScreenHeader } from '../components/ScreenHeader';
import { designSystem } from '../theme/designSystem';
import runDatabaseDiagnostics from '../utils/databaseDiagnostics';
import { DataMapper } from '../utils/dataMapper';

const STARTER_CATEGORIES = [
  {
    id: 'fitness',
    title: 'Workout & Fitness',
    icon: 'dumbbell',
    items: [
      { id: 'f1', title: 'Plan my next workout', prompt: 'I am ready for a workout. Can you plan a session for me based on my goals?' },
      { id: 'f2', title: 'Form check help', prompt: 'Can you explain the correct form for a deadlift?' },
      { id: 'f3', title: 'Break a plateau', prompt: 'I feel stuck with my current weights. How do I break this plateau?' },
    ]
  },
  {
    id: 'nutrition',
    title: 'Nutrition & Diet',
    icon: 'food-apple',
    items: [
      { id: 'n1', title: 'Post-workout meal', prompt: 'What should I eat after my workout for best recovery?' },
      { id: 'n2', title: 'Energy boost', prompt: 'I feel tired today. What foods can give me a natural energy boost?' },
      { id: 'n3', title: 'Protein goals', prompt: 'How much protein should I be aiming for daily?' },
    ]
  },
  {
    id: 'recovery',
    title: 'Recovery & Mindset',
    icon: 'heart-pulse',
    items: [
      { id: 'r1', title: 'Stretching routine', prompt: 'Can you guide me through a 5-minute cool-down stretch?' },
      { id: 'r2', title: 'Better sleep', prompt: 'What are some tips for improving my sleep quality for better gym performance?' },
      { id: 'r3', title: 'Stay motivated', prompt: 'I am struggling to stay consistent. Give me some motivation to hit the gym today.' },
    ]
  }
];

const FOLLOW_UPS = [
  { id: 'f1', title: 'Tell me more', prompt: 'Can you give me more details on that?' },
  { id: 'f2', title: 'Simplify this', prompt: 'Can you explain that more simply?' },
  { id: 'f3', title: 'Example?', prompt: 'Can you give me an example of how to do this?' },
  { id: 'f4', title: 'Thanks coach!', prompt: 'Thanks coach! That was helpful.' },
];

// ------------------------------------------------------------------
// ANIMATED THINKING INDICATOR (Premium Bouncing Dots)
// ------------------------------------------------------------------
const ThinkingIndicator = ({ theme }: { theme: any }) => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) => {
      Animated.sequence([
        Animated.delay(delay),
        Animated.loop(
          Animated.sequence([
            Animated.timing(dot, {
              toValue: -6,
              duration: 350,
              useNativeDriver: true,
            }),
            Animated.timing(dot, {
              toValue: 0,
              duration: 350,
              useNativeDriver: true,
            }),
            Animated.delay(400),
          ])
        )
      ]).start();
    };

    animateDot(dot1, 0);
    animateDot(dot2, 150);
    animateDot(dot3, 300);
    
    return () => {
      dot1.stopAnimation();
      dot2.stopAnimation();
      dot3.stopAnimation();
    };
  }, []);

  return (
    <View style={styles.loadingDotsContainer}>
      <Animated.View style={[styles.loadingDot, { backgroundColor: theme.textSecondary, transform: [{ translateY: dot1 }] }]} />
      <Animated.View style={[styles.loadingDot, { backgroundColor: theme.textSecondary, transform: [{ translateY: dot2 }] }]} />
      <Animated.View style={[styles.loadingDot, { backgroundColor: theme.textSecondary, transform: [{ translateY: dot3 }] }]} />
    </View>
  );
};

// ------------------------------------------------------------------
// MESSAGE BUBBLE COMPONENT
// ------------------------------------------------------------------
const MessageItem = React.memo(({ item, theme, isFirstInGroup, isLastInGroup }: { item: any; theme: any; isFirstInGroup?: boolean; isLastInGroup?: boolean }) => {
  const slideAnim = useRef(new Animated.Value(15)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, damping: 15, stiffness: 150, useNativeDriver: true })
    ]).start();
  }, [opacityAnim, slideAnim]);

  if (item.type === 'date') {
    // We recreate getDateLabel logic here
    const date = new Date(item.date);
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    let label = '';
    if (item.date === today) label = 'Today';
    else if (item.date === yesterday) label = 'Yesterday';
    else label = date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });

    return (
      <View style={styles.dateDividerContainer}>
        <View style={[styles.dateLabel, { backgroundColor: theme.backgroundCard }]}>
          <Text style={[styles.dateLabelText, { color: theme.textMuted }]}>{label.toUpperCase()}</Text>
        </View>
      </View>
    );
  }

  const isUser = item.sender === 'user';
  const timeStr = item.time ? new Date(item.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
  
  // Use gender from theme for AI avatar
  const isFemale = theme.primary === designSystem.colors.female.light.primary || theme.primary === designSystem.colors.female.dark.primary;
  const aiAvatarColor = isFemale ? designSystem.colors.female.light.primary : designSystem.colors.male.light.primary;
  const aiIcon = isFemale ? 'face-woman-shimmer' : 'face-man-shimmer';

  // Dynamic Border Radiuses based on sequence
  const radius = 24;
  const smallRadius = 10;
  
  const bubbleStyles = {
    borderTopLeftRadius: isUser ? radius : (isFirstInGroup ? radius : smallRadius),
    borderBottomLeftRadius: isUser ? radius : (isLastInGroup ? radius : smallRadius),
    borderTopRightRadius: isUser ? (isFirstInGroup ? radius : smallRadius) : radius,
    borderBottomRightRadius: isUser ? (isLastInGroup ? radius : smallRadius) : radius,
  };

  return (
    <Animated.View style={[styles.messageRow, isUser ? styles.rowUser : styles.rowAi, { opacity: opacityAnim, transform: [{ translateY: slideAnim }] }]}>
      {!isUser && (
        <View style={styles.aiAvatarWrapper}>
          <LinearGradient
            colors={[aiAvatarColor + '40', 'transparent']}
            style={styles.avatarGlow}
          />
          <View style={[styles.aiAvatar, { backgroundColor: aiAvatarColor }]} accessible={true} accessibilityLabel="AI Coach">
            <MaterialCommunityIcons name={aiIcon as any} size={18} color="#FFF" />
          </View>
        </View>
      )}
      <View style={[styles.bubbleWrapper, isUser && styles.bubbleWrapperUser]}>
        <View style={[
          styles.bubble,
          bubbleStyles,
          { overflow: 'hidden' },
          !isUser && {
            borderWidth: 1,
            borderColor: aiAvatarColor + '40',
            shadowColor: aiAvatarColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
          }
        ]}>
          <BlurView
            intensity={isUser ? 30 : 65}
            tint="light"
            style={[StyleSheet.absoluteFill, { backgroundColor: isUser ? 'rgba(230, 235, 240, 0.7)' : 'rgba(255, 255, 255, 0.85)' }]}
          />
          <Text style={[
            styles.messageText,
            { color: '#1B2E1B' }
          ]}>{item.text}</Text>
        </View>
        {(isLastInGroup && timeStr) ? (
          <Text style={[styles.messageTime, { color: theme.textMuted }]}>{timeStr}</Text>
        ) : null}
      </View>
    </Animated.View>
  );
});

const GlowingOrb = ({ theme }: { theme: any }) => {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 4000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.orbContainer}>
      <Animated.View style={[styles.orbGlow, { borderColor: theme.primary, transform: [{ rotate }] }]} />
      <LinearGradient
        colors={[theme.primary, theme.primaryLight || theme.primary]}
        style={styles.orbInner}
      >
        <MaterialCommunityIcons name="auto-fix" size={32} color="#FFF" />
      </LinearGradient>
    </View>
  );
};

export default function AIInstructorScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  // State
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [session, setSession] = useState<InstructorService.ChatCredentials | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyGroups, setHistoryGroups] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [userMemory, setUserMemory] = useState<any>(null); // Memory Context

  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitModalConfig, setLimitModalConfig] = useState<any>({});

  // Input starts at one-line height, grows with content up to max
  const INPUT_LINE_HEIGHT = 44;
  const INPUT_MAX_HEIGHT = 120;
  const [inputHeight, setInputHeight] = useState(INPUT_LINE_HEIGHT);

  // Use actual keyboard height so input sits just above keyboard on any device (KeyboardAvoidingView is unreliable)
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(show, (e) => {
      setKeyboardVisible(true);
      setKeyboardHeight(e.endCoordinates.height);
    });
    const subHide = Keyboard.addListener(hide, () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  const flatListRef = useRef<FlatList>(null);

  // 1. Initialize Session
  useFocusEffect(
    useCallback(() => {
      let isSubscribed = true;

      const init = async () => {
        // FIX: Immediate exit if no user, but MUST set isReady to true to show UI
        if (!user?.id) {
          if (isSubscribed) setIsReady(true);
          return;
        }

        try {
          // Timeout protection to prevent infinite loading
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Request timed out")), 8000)
          );

          const loadData = async () => {
            // 1. Get Identifiers (Local -> DB -> New)
            const creds = await InstructorService.getSessionIdentifiers(user.id!);
            const memory = await InstructorService.getUserMemory(user.id!);

            if (isSubscribed) {
              setSession(creds);
              setUserMemory(memory);

              // 2. FORCE RESTORE: Fetch ALL history for USER (Continuous Mode)
              const history = await InstructorService.fetchConversations(user.id!, creds.threadId, 'ALL', 50);

              if (isSubscribed) {
                // If history is empty, it might be a new valid session, but if not, we show what we found
                if (history && history.length > 0) {
                  setMessages(history);
                  setHasMore(history.length >= 50);
                } else {
                  // Only if truly empty do we show empty state
                  setMessages([]);
                }
              }
            }
          };

          await Promise.race([loadData(), timeoutPromise]);

        } catch (e) {
          console.error("[Chat Debugger] Init Error:", e);
          // Optional: Show error toast/alert if needed, but logging is sufficient for now
        } finally {
          if (isSubscribed) setIsReady(true);
        }
      };

      init();
      return () => { isSubscribed = false; };
    }, [user?.id])
  );
  // 1.1 HANDLE PROACTIVE MESSAGE FROM DASHBOARD
  useEffect(() => {
    const initialMessage = route?.params?.initialMessage;
    if (initialMessage && isReady && session) {
      // Check if this message was already shown in the history or optimistically
      const isAlreadyInChat = messages.some(m => m.text === initialMessage);

      if (!isAlreadyInChat && !isSending) {
        // We don't "send" it as a user, we show it as an AI message if it came from AI
        // Actually, the generateProactiveMessage generates a QUESTION.
        // So we should show it as an AI message.

        const aiMsg = {
          id: `ai-proactive-${Date.now()}`,
          sender: 'ai',
          text: initialMessage,
          time: new Date()
        };
        setMessages((prev) => [aiMsg, ...prev]);

        // Persist it
        InstructorService.storeMessage(session, 'ai', initialMessage).catch(console.error);
      }
    }
  }, [route?.params?.initialMessage, isReady, session]);

  // 1.2 REAL-TIME SUBSCRIPTION
  useEffect(() => {
    if (!user?.id || !session?.chatId) return;

    // Listen for NEW messages in this specific chat
    const channel = supabase
      .channel(`chat_${session.chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations',
          filter: `chat_id=eq.${session.chatId}`
        },
        (payload: any) => {
          const newMsg = payload.new;
          // Avoid duplicates if we already added it optimistically
          setMessages((prev) => {
            const exists = prev.some(m => m.id === newMsg.id || (m.text === newMsg.message && m.sender === newMsg.sender && Math.abs(new Date(m.time).getTime() - new Date(newMsg.timestamp).getTime()) < 2000));
            if (exists) return prev;

            const msg = {
              id: newMsg.id,
              sender: newMsg.sender,
              text: newMsg.message,
              time: new Date(newMsg.timestamp)
            };
            return [msg, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user?.id, session?.chatId]);

  const loadMore = async () => {
    if (isLoadingMore || !hasMore || !session || !user?.id) return;
    setIsLoadingMore(true);
    try {
      // Find oldest message timestamp
      const oldestMsg = messages[messages.length - 1];
      const history = await InstructorService.fetchConversations(
        user.id,
        session.threadId,
        'ALL',
        30,
        oldestMsg?.time
      );

      if (history.length > 0) {
        setMessages(prev => [...prev, ...history]);
        setHasMore(history.length === 30);
      } else {
        setHasMore(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // 1.5 Fetch History Groups
  useEffect(() => {
    if (showHistory && user?.id) {
      loadHistoryGroups();
    }
  }, [showHistory, user?.id]);

  const loadHistoryGroups = async () => {
    if (!user?.id) return;
    setIsLoadingHistory(true);
    try {
      const groups = await InstructorService.getChatHistoryGroups(user.id);
      setHistoryGroups(groups);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleNewChat = () => {
    Alert.alert(
      'New Chat',
      'Start a new conversation topic?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'New Chat',
          onPress: async () => {
            if (!user?.id || !session) return;
            const newChatId = InstructorService.createUUID();
            const storageKey = `Gymz_ai_instructor_${user.id}`;
            const newCreds = { ...session, chatId: newChatId };

            await AsyncStorage.setItem(storageKey, JSON.stringify(newCreds));
            setSession(newCreds);
            setMessages([]);
            setShowHistory(false);
          }
        }
      ]
    );
  };

  const handleOptions = () => {
    Alert.alert(
      'Chat Options',
      'Manage your current conversation.',
      [
        {
          text: 'Clear Chat Permanently',
          onPress: () => {
            Alert.alert(
              "Permanently Delete?",
              "This will remove this conversation from the database and your local storage forever.",
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: handleClearCurrentChat }
              ],
              { cancelable: true }
            );
          },
          style: 'destructive'
        },
        { text: 'Cancel', style: 'cancel' }
      ],
      { cancelable: true }
    );
  };

  const handleClearCurrentChat = async () => {
    if (!session?.chatId || !user?.id) return;
    try {
      setIsSending(true);
      await InstructorService.clearChatMessages(session.chatId, user.id);
      setMessages([]);
      Alert.alert("Success", "This conversation has been cleared.");
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to clear chat. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const loadChat = async (chatId: string) => {
    if (!user?.id || !session) return;
    setIsReady(false);
    try {
      const storageKey = `Gymz_ai_instructor_${user.id}`;
      const newCreds = { ...session, chatId };
      await AsyncStorage.setItem(storageKey, JSON.stringify(newCreds));
      setSession(newCreds);

      const history = await InstructorService.fetchConversations(user.id, session.threadId, chatId, 50);
      setMessages(history);
      setShowHistory(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsReady(true);
    }
  };

  // 2. Auto-scroll removed as inverted FlatList handles this 

  // 3. Date Grouping Helper
  const getGroupedMessages = () => {
    const grouped: any[] = [];
    messages.forEach((msg, idx) => {
      grouped.push(msg);

      const currentMsgDate = new Date(msg.time).toDateString();
      const nextMsgDate = messages[idx + 1] ? new Date(messages[idx + 1].time).toDateString() : null;

      if (currentMsgDate !== nextMsgDate) {
        grouped.push({ id: `date-${currentMsgDate}`, type: 'date', date: currentMsgDate });
      }
    });
    return grouped;
  };

  // Humanized date label for dividers (Today / Yesterday / full date)
  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (dateStr === today) return 'Today';
    if (dateStr === yesterday) return 'Yesterday';
    return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  };

  // 3. Send Logic - Matches GMS Community Chat pattern
  const handleSend = async (overrideText?: string) => {
    const textToSend = overrideText || input.trim();
    if (!textToSend || !session || isSending || !user?.id) return;

    setInput('');
    setInputHeight(INPUT_LINE_HEIGHT);
    setIsSending(true);

    // Optimistic UI update
    const userMsg = {
      id: `temp-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      time: new Date()
    };
    setMessages((prev) => [userMsg, ...prev]);

    try {
      // 1. Try to save user message to database
      try {
        await InstructorService.storeMessage(session, 'user', textToSend);
        console.log("[Chat] ✅ User message saved to DB");
      } catch (dbError) {
        console.warn("[Chat] ⚠️  DB save failed, will retry:", dbError);
      }

      // 2. Fetch Full Live Context
      const fullContext = await InstructorService.getUserFullContext(user.id);
      
      // FALLBACK: If DB fetch missed the name, use the session user name
      if (fullContext.profile && !fullContext.profile.firstName && !fullContext.profile.first_name) {
        fullContext.profile.firstName = user.firstName || user.name || user.email?.split('@')[0];
      }

      // Build history (last 10 messages, chronological)
      const recentHistory = messages
        .slice(0, 10)
        .reverse()
        .map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text
        }));

      // 3. Call AI
      const response = await InstructorService.postToAI(session, textToSend, fullContext, 'coach', recentHistory);

      // 3. Save AI response and show in UI
      if (response?.reply) {
        const aiMsg = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: response.reply,
          time: new Date()
        };
        setMessages((prev) => [aiMsg, ...prev]);

        // Try to save AI message
        try {
          await InstructorService.storeMessage(session, 'ai', response.reply);
          console.log("[Chat] ✅ AI message saved to DB");
        } catch (dbError) {
          console.warn("[Chat] ⚠️  AI save failed:", dbError);
        }
      }
    } catch (error: any) {
      console.error("[Chat] Send Error:", error);

      // Show user-friendly error
      const errorMsg = error?.message?.includes("Failed to store message")
        ? "Failed to save your message. Please check your connection and try again."
        : "I couldn't process that message. Please try again.";

      Alert.alert("Message Failed", errorMsg);

      // Reload from database to show actual saved state
      if (user?.id && session) {
        try {
          const history = await InstructorService.fetchConversations(
            user.id,
            session.threadId,
            session.chatId,
            50
          );
          setMessages(history);
        } catch (reloadError) {
          console.error("[Chat] Failed to reload from DB:", reloadError);
        }
      }
    } finally {
      setIsSending(false);
    }
  };

  // ------------------------------------------------------------------
  // UI RENDER
  // ------------------------------------------------------------------

  if (!isReady) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.text} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <View style={[styles.header, {
        borderBottomColor: theme.border,
        paddingTop: 8
      }]}>
        <View style={[styles.headerLeft, { zIndex: 10 }]}>
          {showHistory ? (
            <TouchableOpacity
              onPress={() => setShowHistory(false)}
              style={styles.headerButton}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
              <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
            </TouchableOpacity>
          ) : (
            navigation.canGoBack() && (
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => navigation.goBack()}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              >
                <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
              </TouchableOpacity>
            )
          )}
        </View>

        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
          {showHistory ? "History" : "AI Coach"}
        </Text>

        <View style={styles.headerRight}>
          {!showHistory ? (
            <TouchableOpacity
              onPress={handleOptions}
              style={styles.headerButton}
              activeOpacity={0.7}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <MaterialCommunityIcons name="dots-vertical" size={26} color={theme.text} />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerButton} />
          )}
        </View>
      </View>

      {showHistory ? (
        // HISTORY VIEW
        <ScrollView style={styles.historyArea} contentContainerStyle={styles.historyContent}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Previous Conversations</Text>
          {isLoadingHistory ? (
            <ActivityIndicator size="small" color={theme.text} style={{ marginTop: 20 }} />
          ) : historyGroups.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ color: theme.textMuted }}>No history found.</Text>
            </View>
          ) : (
            historyGroups.map((group) => (
              <TouchableOpacity
                key={group.chatId}
                style={[styles.historyItem, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}
                onPress={() => loadChat(group.chatId)}
              >
                <View style={styles.historyIcon}>
                  <MaterialCommunityIcons name="message-text-outline" size={20} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.historyItemTitle, { color: theme.text }]} numberOfLines={1}>{group.title}</Text>
                  <Text style={[styles.historyItemDate, { color: theme.textSecondary }]}>{group.timestamp.toLocaleDateString()}</Text>
                </View>
                {session?.chatId === group.chatId && (
                  <View style={[styles.activeDot, { backgroundColor: theme.primary }]} />
                )}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      ) : (
        // CHAT VIEW: paddingBottom = actual keyboard height so input bar sits just above keyboard on any phone
        <View style={[styles.chatArea, { paddingBottom: keyboardHeight }]}>
        <View style={styles.chatAreaInner}>
          {getGroupedMessages().length === 0 ? (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={[styles.emptyStateContainer, { paddingTop: 20, paddingBottom: 140, flexGrow: 1, justifyContent: 'flex-start', alignItems: 'center' }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <GlowingOrb theme={theme} />
              <Text style={[styles.personalizedTitle, { color: theme.textSecondary, marginTop: 20 }]}>Gymz Intelligence</Text>
              <View style={[styles.suggestionsContainer, { alignItems: 'center' }]}>
                {STARTER_CATEGORIES[0].items.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.suggestionChip, designSystem.glass.light]}
                    onPress={() => handleSend(item.prompt)}
                  >
                    <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
                    <Text style={[styles.suggestionText, { color: theme.text }]}>{item.title}</Text>
                  </TouchableOpacity>
                ))}
                {STARTER_CATEGORIES[1].items.slice(0, 2).map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.suggestionChip, designSystem.glass.light]}
                    onPress={() => handleSend(item.prompt)}
                  >
                    <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
                    <Text style={[styles.suggestionText, { color: theme.text }]}>{item.title}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          ) : (
          <FlatList
            ref={flatListRef}
            scrollEnabled={true}
            data={getGroupedMessages()}
            inverted
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.chatListContent, { paddingBottom: 140, flexGrow: 1 }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            bounces={true}
            overScrollMode="always"
            onEndReached={loadMore}
            renderItem={({ item, index }) => {
              const grouped = getGroupedMessages();
              const prevItem = grouped[index + 1]; // Inverted list, so next index is previous chronological message
              const nextItem = grouped[index - 1]; // Inverted list, so prev index is next chronological message

              const isFirstInGroup = !prevItem || prevItem.sender !== item.sender || prevItem.type === 'date';
              const isLastInGroup = !nextItem || nextItem.sender !== item.sender || nextItem.type === 'date';

              return (
                <MessageItem 
                  item={item} 
                  theme={theme} 
                  isFirstInGroup={isFirstInGroup}
                  isLastInGroup={isLastInGroup}
                />
              );
            }}
            ListHeaderComponent={
              isSending ? (
                <View style={styles.thinkingContainer}>
                  <ThinkingIndicator theme={theme} />
                </View>
              ) : null
            }
            style={{ flex: 1 }}
          />
          )}

          {/* QUICK REPLIES (when conversation has messages) */}
          {messages.length > 0 && !isSending && (
            <View style={[styles.quickRepliesWrap, { borderTopColor: theme.border }]}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickRepliesContent}
              >
                {FOLLOW_UPS.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.quickReplyChip, designSystem.glass.light, { borderColor: theme.border }]}
                    onPress={() => handleSend(item.prompt)}
                    activeOpacity={0.7}
                  >
                    <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
                    <Text style={[styles.quickReplyText, { color: theme.textSecondary }]}>{item.title}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* INPUT AREA — when keyboard open: minimal padding above keyboard; when closed: small gap + safe area so input sits right above bottom tabs */}
            <View style={[styles.inputContainer, { paddingBottom: keyboardVisible ? 10 : 12 + insets.bottom }]}>
              <BlurView intensity={70} tint="light" style={[StyleSheet.absoluteFill, { borderRadius: 24, backgroundColor: 'rgba(255, 255, 255, 0.92)' }]} />
              <View style={[styles.inputFieldContainer]}>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      color: '#1B2E1B',
                      minHeight: INPUT_LINE_HEIGHT,
                      maxHeight: INPUT_MAX_HEIGHT,
                      height: inputHeight,
                      backgroundColor: 'rgba(255, 255, 255, 0.98)',
                      borderWidth: 1,
                      borderColor: 'rgba(27, 46, 27, 0.18)',
                      outlineStyle: 'none',
                    } as any,
                  ]}
                  placeholder="Ask AI Coach"
                  placeholderTextColor="rgba(27, 46, 27, 0.45)"
                  value={input}
                  onChangeText={setInput}
                  onContentSizeChange={(e) => {
                    const h = e.nativeEvent.contentSize.height;
                    setInputHeight(Math.min(INPUT_MAX_HEIGHT, Math.max(INPUT_LINE_HEIGHT, h + 4)));
                  }}
                  multiline={true}
                  blurOnSubmit={false}
                  onSubmitEditing={(e) => {
                    if (Platform.OS === 'web') {
                      const nativeEvent = (e as any).nativeEvent;
                      if (!nativeEvent.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    } else {
                      handleSend();
                    }
                  }}
                  returnKeyType="send"
                  underlineColorAndroid="transparent"
                />
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    { backgroundColor: input.trim() ? '#1B2E1B' : 'rgba(27, 46, 27, 0.12)' }
                  ]}
                  onPress={() => handleSend()}
                  disabled={!input.trim() || isSending}
                >
                  {isSending ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <MaterialCommunityIcons name="arrow-up" size={20} color="#FFF" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
        </View>
        </View>
      )}

      <FeatureLimitModal
        visible={showLimitModal}
        title={limitModalConfig.title}
        message={limitModalConfig.message}
        actionLabel={limitModalConfig.actionLabel}
        icon={limitModalConfig.icon}
        isTrial={limitModalConfig.status === 'pending'}
        onClose={() => setShowLimitModal(false)}
        onAction={() => {
          setShowLimitModal(false);
          navigation.navigate('SubscriptionPlans');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'space-between',
    minHeight: 48,
  },
  headerLeft: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerRight: {
    width: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 48, // Standard margin to prevent overlapping buttons
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyArea: {
    flex: 1,
  },
  historyContent: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 15,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  historyIcon: {
    marginRight: 12,
    opacity: 0.7,
  },
  historyItemTitle: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  historyItemDate: {
    fontSize: 12,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginLeft: 10,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 50,
  },
  chatArea: {
    flex: 1,
  },
  chatAreaInner: {
    flex: 1,
  },
  chatListContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  emptyStateContainer: {
    paddingHorizontal: 20,
  },
  personalizedTitle: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 15,
  },
  suggestionsContainer: {
    alignItems: 'flex-start',
    gap: 10,
  },
  suggestionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dateDivider: {
    textAlign: 'center',
    fontSize: 11,
    marginVertical: 15,
    opacity: 0.6,
  },
  dateDividerContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 14,
    alignItems: 'flex-end',
  },
  rowUser: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
    maxWidth: '88%',
  },
  rowAi: {
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
    maxWidth: '88%',
  },
  aiAvatarWrapper: {
    marginRight: 10,
    marginBottom: 4,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarGlow: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    opacity: 0.6,
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubbleWrapper: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    flexShrink: 1,
    maxWidth: '100%',
  },
  bubbleWrapperUser: {
    alignItems: 'flex-end',
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexShrink: 1,
    maxWidth: '100%',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
    marginHorizontal: 4,
  },
  orbContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  orbGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderStyle: 'dashed',
    opacity: 0.3,
  },
  orbInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0062FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  quickRepliesWrap: {
    borderTopWidth: 1,
    paddingVertical: 8,
    paddingBottom: 4,
  },
  quickRepliesContent: {
    paddingHorizontal: 16,
    flexDirection: 'row',
  },
  quickReplyChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    overflow: 'hidden',
  },
  quickReplyText: {
    fontSize: 13,
    fontWeight: '500',
  },
  inputContainer: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 12,
    marginBottom: 20,
    borderRadius: 24,
    overflow: 'hidden',
  },
  inputFieldContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 2,
    gap: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    overflow: 'hidden',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
    overflow: 'hidden',
  },
  suggestionChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  // Thinking Indicator Styles
  loadingDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 6,
  },
  loadingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#888',
  },
  // Missing Date Headers for old function
  dateHeader: {
    alignItems: 'center',
    marginVertical: 24,
  },
  dateLabel: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(125,125,125,0.1)',
  },
  dateLabelText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  thinkingContainer: {},
});
