import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications() {
  try {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    const projectId =
      (Constants.expoConfig as any)?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId;

    token = (
      await Notifications.getExpoPushTokenAsync(
        projectId ? ({ projectId } as any) : undefined
      )
    ).data;
    console.log('Push token:', token);

    return token;
  } catch (error) {
    console.error('Error in registerForPushNotifications:', error);
    return null;
  }
}

/** Show an immediate local notification (overlay on top of app) */
export async function presentLocalNotification(title: string, body: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        ...(Platform.OS === 'android' && {
          vibrationPattern: [0, 250, 250, 250],
          channelId: 'default',
        }),
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('[Notifications] presentLocalNotification failed:', e);
  }
}

export async function scheduleNotification(title: string, body: string, trigger: Date) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: trigger,
      ...(Platform.OS === 'android' && { channelId: 'default' }),
    },
  });
}

export function addNotificationReceivedListener(
  listener: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(listener);
}

export function addNotificationResponseReceivedListener(
  listener: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(listener);
}

/** Get the notification that opened the app (cold start from tap). Call early on app load. */
export function getLastNotificationResponseAsync(): Promise<Notifications.NotificationResponse | null> {
  return Notifications.getLastNotificationResponseAsync();
}

// --- Push tap → screen mapping (shared with NotificationBell and AppNavigator) ---

export function actionUrlToScreen(actionUrl: string | null | undefined): string {
  if (!actionUrl || typeof actionUrl !== 'string') return 'Main';
  const lower = actionUrl.toLowerCase().replace(/\/$/, '');
  if (lower.includes('payment') || lower.includes('finance')) return 'Payments';
  if (lower.includes('profile')) return 'Profile';
  if (lower.includes('nutrition')) return 'Nutrition';
  if (lower.includes('dashboard') || lower.includes('main')) return 'Main';
  if (lower === 'payments') return 'Payments';
  if (lower === 'nutrition') return 'Nutrition';
  if (lower === 'settings') return 'Settings';
  if (lower.includes('eventdetail')) return 'EventDetail';
  if (lower.includes('event')) return 'EventHome';
  return 'Main';
}

export type NotificationTapTarget =
  | { type: 'screen'; screen: string; params?: object }
  | { type: 'message'; title: string; body: string };

/**
 * From push notification content.data (and title/body), decide whether to navigate to a screen or show message popup.
 * If data has action_url (or screen) that maps to a real screen, returns { type: 'screen', ... }.
 * Otherwise returns { type: 'message', title, body } so the app can show a popup.
 */
export function getNotificationTapTarget(
  data: Record<string, unknown> | undefined,
  title: string,
  body: string
): NotificationTapTarget {
  if (!data || typeof data !== 'object') {
    return { type: 'message', title: title || 'Notification', body: body || '' };
  }
  const actionUrl = data.action_url as string | undefined;
  const screenName = data.screen as string | undefined;
  const eventId = data.event_id as string | undefined;

  const resolvedScreen = screenName || (actionUrl ? actionUrlToScreen(actionUrl) : null);
  if (resolvedScreen) {
    const params = eventId && resolvedScreen === 'EventDetail' ? { eventId } : undefined;
    return { type: 'screen', screen: resolvedScreen, params };
  }
  return {
    type: 'message',
    title: (data.title as string) || title || 'Notification',
    body: (data.body as string) || body || '',
  };
}

export async function scheduleDailyNotification(title: string, body: string, hour: number, minute: number, identifier: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      categoryIdentifier: 'nutrition',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    } as any,
    identifier,
  });
}

export async function cancelNotification(identifier: string) {
  await Notifications.cancelScheduledNotificationAsync(identifier);
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

