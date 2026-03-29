import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Text,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Swipeable, FlatList, GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { formatDistanceToNow } from 'date-fns';
import { useNotificationBanner } from '../../contexts/NotificationBannerContext';
import { useRootNavigationRef } from '../../contexts/RootNavigationRefContext';
import { actionUrlToScreen } from '../../services/notifications';

interface Notification {
  id: string;
  message: string;
  title?: string | null;
  sender_name?: string | null;
  sender_type?: string | null;
  type: string;
  is_read: boolean;
  read: boolean;
  status: string;
  priority: number;
  created_at: string;
  acknowledged_at?: string;
  action_url?: string | null;
  action_label?: string | null;
  metadata?: { image_url?: string; event_id?: string } | null;
}

export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const rootNavRef = useRootNavigationRef();
  const showBanner = useNotificationBanner();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [messagePopup, setMessagePopup] = useState<{ title: string; body: string } | null>(null);
  const openSwipeableRef = useRef<Swipeable | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, message, title, sender_name, sender_type, type, is_read, read, status, priority, created_at, action_url, action_label, metadata')
        .eq('user_id', user.id)
        .neq('type', 'admin_update')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        // Rank by day received (newest first); use priority as tie-breaker within same time
        const sorted = [...(data as Notification[])].sort((a, b) => {
          const timeA = new Date(a.created_at).getTime();
          const timeB = new Date(b.created_at).getTime();
          if (timeA !== timeB) return timeB - timeA; // newest first
          return (a.priority ?? 0) - (b.priority ?? 0);
        });
        const count = (data as Notification[]).filter(
          (n) => n.status === 'unread' || (!n.is_read && !n.read)
        ).length;
        setNotifications(sorted);
        setUnreadCount(count);
      }
    };

    fetchNotifications();

    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          fetchNotifications();
          const eventType = payload?.eventType ?? payload?.event;
          if (eventType === 'INSERT') {
            const newRow = payload.new as Notification;
            if (newRow?.type !== 'admin_update') {
              const title = newRow?.title || 'Admin';
              const body = newRow?.message || 'New notification';
              const imageUrl = newRow?.metadata?.image_url;
              showBanner?.showBanner({
                title,
                body,
                imageUrl: imageUrl || null,
                type: newRow?.type,
                onPress: () => {
                  setModalVisible(true);
                },
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      void channel.unsubscribe();
    };
  }, [user?.id]);

  const markAsRead = async (notificationId: string) => {
    try {
      await (supabase as any)
        .from('notifications')
        .update({ is_read: true, read: true, status: 'read' })
        .eq('id', notificationId);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true, read: true, status: 'read' } : n
        )
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (e) {
      console.warn('markAsRead failed:', e);
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications
      .filter((n) => n.status === 'unread' || (!n.is_read && !n.read))
      .map((n) => n.id);
    if (unreadIds.length === 0) return;
    try {
      await (supabase as any)
        .from('notifications')
        .update({ is_read: true, read: true, status: 'read' })
        .in('id', unreadIds);
      setUnreadCount(0);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read: true, status: 'read' }))
      );
    } catch (e) {
      console.warn('markAllAsRead failed:', e);
    }
  };

  const acknowledge = async (notificationId: string) => {
    try {
      await (supabase as any)
        .from('notifications')
        .update({
          status: 'acknowledged',
          acknowledged_at: new Date().toISOString(),
          is_read: true,
        })
        .eq('id', notificationId);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, status: 'acknowledged', is_read: true } : n
        )
      );
    } catch (e) {
      console.warn('acknowledge failed:', e);
    }
  };

  const deleteNotification = useCallback(
    async (item: Notification, swipeableRef: Swipeable | null) => {
      swipeableRef?.close();
      try {
        const { error } = await (supabase as any)
          .from('notifications')
          .delete()
          .eq('id', item.id)
          .eq('user_id', user?.id);
        if (error) throw error;
        const wasUnread = item.status === 'unread' || (!item.is_read && !item.read);
        setNotifications((prev) => prev.filter((n) => n.id !== item.id));
        if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
      } catch (e) {
        console.warn('deleteNotification failed:', e);
        Alert.alert(
          'Could not delete',
          'This notification could not be removed. You can try again later.'
        );
      }
    },
    [user?.id]
  );

  const renderRightActions = useCallback(
    (
      _progress: unknown,
      _dragX: unknown,
      swipeable: Swipeable,
      item: Notification
    ) => (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => deleteNotification(item, swipeable)}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="delete-outline" size={22} color="#FFF" />
        <Text style={styles.deleteActionText}>Delete</Text>
      </TouchableOpacity>
    ),
    [deleteNotification]
  );

  const handleNotificationPress = (item: Notification) => {
    markAsRead(item.id);
    const screen = actionUrlToScreen(item.action_url);
    const params = item.metadata?.event_id && screen === 'EventDetail'
      ? { eventId: item.metadata.event_id }
      : undefined;
    const hasLinkedScreen = !!(item.action_url && screen !== 'Main');
    setModalVisible(false);

    if (hasLinkedScreen && rootNavRef?.isReady?.()) {
      try {
        (rootNavRef as any).navigate(screen, params);
      } catch (e) {
        console.warn('Notification navigate failed:', e);
        setMessagePopup({ title: item.sender_type === 'admin' ? 'Admin' : (item.title || 'Admin'), body: item.message });
      }
    } else if (hasLinkedScreen) {
      const fallbackNav = navigation.getParent()?.getParent?.() ?? navigation.getParent() ?? navigation;
      setTimeout(() => {
        try {
          (fallbackNav as any)?.navigate(screen, params);
        } catch (e) {
          console.warn('Notification navigate failed:', e);
          setMessagePopup({ title: item.sender_type === 'admin' ? 'Admin' : (item.title || 'Admin'), body: item.message });
        }
      }, 350);
    } else {
          setMessagePopup({ title: item.sender_type === 'admin' ? 'Admin' : (item.title || 'Admin'), body: item.message });
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'payment_approved':
      case 'payment_completed':
      case 'payment':
        return 'check-circle';
      case 'payment_pending':
        return 'clock-outline';
      case 'payment_rejected':
        return 'close-circle';
      case 'admin_message':
      case 'event_announcement':
        return 'bell-ring';
      default:
        return 'information';
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'payment_approved':
      case 'payment_completed':
      case 'payment':
        return '#22c55e';
      case 'payment_pending':
        return '#f59e0b';
      case 'payment_rejected':
        return '#ef4444';
      case 'admin_message':
      case 'event_announcement':
        return theme.primary;
      default:
        return theme.primary;
    }
  };

  const isUnread = (n: Notification) => n.status === 'unread' || (!n.is_read && !n.read);

  return (
    <>
      <TouchableOpacity
        onPress={() => {
          setModalVisible(true);
          markAllAsRead();
        }}
        style={styles.bellButton}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons name="bell-outline" size={24} color={theme.text} />
        {unreadCount > 0 && (
          <View style={[styles.badge, { backgroundColor: theme.primary }]}>
            <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={[styles.unreadPill, { backgroundColor: theme.primary }]}>
                <Text style={styles.unreadPillText}>{unreadCount} new</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <MaterialCommunityIcons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {notifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconWrap, { backgroundColor: theme.primary + '20' }]}>
                <MaterialCommunityIcons name="bell-outline" size={48} color={theme.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No notifications yet</Text>
              <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                We&apos;ll notify you about payments, updates, and more.
              </Text>
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const unread = isUnread(item);
                return (
                  <Swipeable
                    onSwipeableWillOpen={() => openSwipeableRef.current?.close()}
                    onSwipeableOpen={(_dir, s) => {
                      openSwipeableRef.current = s;
                    }}
                    renderRightActions={(progress, dragX, swipeable) =>
                      renderRightActions(progress, dragX, swipeable, item)
                    }
                    friction={2}
                    rightThreshold={40}
                    containerStyle={styles.swipeRowContainer}
                    childrenContainerStyle={styles.swipeRowChildren}
                  >
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => handleNotificationPress(item)}
                      style={[
                        styles.notificationCard,
                        {
                          backgroundColor: unread ? theme.primary + '0D' : 'transparent',
                          borderLeftColor: getColor(item.type),
                        },
                        item.priority === 1 && item.status !== 'acknowledged' && styles.criticalCard,
                      ]}
                    >
                      <View style={styles.cardRow}>
                        {item.metadata?.image_url ? (
                          <Image source={{ uri: item.metadata.image_url }} style={styles.cardImage} />
                        ) : (
                          <View style={[styles.iconWrap, { backgroundColor: getColor(item.type) + '25' }]}>
                            <MaterialCommunityIcons
                              name={item.priority === 1 ? 'alert-decagram' : getIcon(item.type)}
                              size={16}
                              color={item.priority === 1 ? '#ef4444' : getColor(item.type)}
                            />
                          </View>
                        )}
                        <View style={styles.cardBody}>
                          <View style={styles.cardTop}>
                            <Text
                              style={[styles.cardTitle, { color: theme.text }, unread && styles.cardTitleUnread]}
                              numberOfLines={1}
                            >
                              {item.sender_type === 'admin' ? 'Admin' : (item.title || 'Admin')}
                            </Text>
                            <Text style={[styles.timeText, { color: theme.textMuted }]}>
                              {formatDistanceToNow(new Date(item.created_at))}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.messageText,
                              { color: unread ? theme.text : theme.textMuted },
                              item.priority === 1 && styles.criticalText,
                            ]}
                            numberOfLines={2}
                          >
                            {item.message}
                          </Text>
                        </View>
                        {unread && <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />}
                      </View>
                      {item.priority === 1 && item.status !== 'acknowledged' && (
                        <TouchableOpacity
                          style={[styles.acknowledgeButton, { backgroundColor: theme.primary }]}
                          onPress={(e) => { e.stopPropagation(); acknowledge(item.id); }}
                        >
                          <Text style={styles.acknowledgeText}>Acknowledge</Text>
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  </Swipeable>
                );
              }}
            />
          )}
          </SafeAreaView>
        </GestureHandlerRootView>
      </Modal>

      {/* Popup when user taps a notification with no linked screen */}
      <Modal
        visible={messagePopup !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMessagePopup(null)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.messagePopupOverlay}
          onPress={() => setMessagePopup(null)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={[styles.messagePopupCard, { backgroundColor: theme.backgroundCard, borderColor: theme.border }]}
          >
            <Text style={[styles.messagePopupTitle, { color: theme.text }]} numberOfLines={1}>
              {messagePopup?.title ?? 'Notification'}
            </Text>
            <Text style={[styles.messagePopupBody, { color: theme.textSecondary }]} selectable>
              {messagePopup?.body ?? ''}
            </Text>
            <TouchableOpacity
              style={[styles.messagePopupButton, { backgroundColor: theme.primary }]}
              onPress={() => setMessagePopup(null)}
            >
              <Text style={styles.messagePopupButtonText}>OK</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  bellButton: {
    padding: 8,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: { borderWidth: 2, borderColor: '#FFF' },
      android: {},
    }),
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    gap: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  unreadPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  unreadPillText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  closeBtn: {
    marginLeft: 'auto',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 15,
    textAlign: 'center',
  },
  listContent: {
    padding: 8,
    paddingBottom: 24,
  },
  swipeRowContainer: {
    marginBottom: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  swipeRowChildren: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  notificationCard: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderLeftWidth: 3,
    borderRadius: 8,
  },
  criticalCard: {
    borderLeftWidth: 4,
  },
  cardRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  cardTitleUnread: {
    fontWeight: '700',
  },
  timeText: {
    fontSize: 11,
    marginLeft: 4,
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
  },
  criticalText: {
    fontWeight: '600',
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  acknowledgeButton: {
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  acknowledgeText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteAction: {
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
  deleteActionText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  messagePopupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  messagePopupCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  messagePopupTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  messagePopupBody: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  messagePopupButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  messagePopupButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
