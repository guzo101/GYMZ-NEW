import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Image,
  Platform,
  Vibration,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

interface BannerData {
  title: string;
  body: string;
  imageUrl?: string | null;
  type?: string;
  onPress?: () => void;
}

interface ContextValue {
  showBanner: (data: BannerData) => void;
}

const NotificationBannerContext = createContext<ContextValue | null>(null);

export function useNotificationBanner() {
  const ctx = useContext(NotificationBannerContext);
  return ctx;
}

export function NotificationBannerProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const [banner, setBanner] = useState<BannerData | null>(null);
  const [anim] = useState(() => new Animated.Value(-150));

  const showBanner = useCallback((data: BannerData) => {
    try {
      Vibration.vibrate([0, 250, 250, 250]);
    } catch (_) {}
    setBanner(data);
    Animated.spring(anim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 10,
    }).start();
  }, [anim]);

  const hideBanner = useCallback(() => {
    Animated.timing(anim, {
      toValue: -150,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setBanner(null);
    });
  }, [anim]);

  const handlePress = useCallback(() => {
    banner?.onPress?.();
    hideBanner();
  }, [banner, hideBanner]);

  const value: ContextValue = { showBanner };

  return (
    <NotificationBannerContext.Provider value={value}>
      {children}
      {banner && (
        <Animated.View
          style={[
            styles.overlay,
            {
              backgroundColor: theme.backgroundCard,
              borderColor: theme.border,
            },
            { transform: [{ translateY: anim }] },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handlePress}
            style={styles.touchable}
          >
            <View style={styles.content}>
              {banner.imageUrl ? (
                <Image source={{ uri: banner.imageUrl }} style={styles.image} />
              ) : (
                <View style={[styles.iconWrap, { backgroundColor: theme.primary + '25' }]}>
                  <MaterialCommunityIcons
                    name={banner.type === 'event_announcement' ? 'calendar-star' : 'bell-ring'}
                    size={28}
                    color={theme.primary}
                  />
                </View>
              )}
              <View style={styles.textWrap}>
                <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                  {banner.title}
                </Text>
                <Text style={[styles.body, { color: theme.textMuted }]} numberOfLines={2}>
                  {banner.body}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={theme.textMuted} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}
    </NotificationBannerContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    zIndex: 9999,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: Platform.OS === 'ios' ? 50 : 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
  touchable: {
    padding: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  image: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
});
