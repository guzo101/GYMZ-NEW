/**
 * DashboardLayoutHeader
 * Clean header for the Dashboard. No hidden margins or padding.
 * Spacing is explicit via dashboardLayoutConstants.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../hooks/useTheme';
import { designSystem } from '../../theme/designSystem';
import { NotificationBell } from '../notifications/NotificationBell';
import { DASHBOARD_LAYOUT } from './dashboardLayoutConstants';

interface DashboardLayoutHeaderProps {
  memberName: string;
  initials: string;
  gender: 'male' | 'female' | 'other';
  avatarUrl?: string | null;
  onProfilePress?: () => void;
  /** Safe area inset from top - required for status bar clearance */
  safeAreaTop: number;
}

export const DashboardLayoutHeader: React.FC<DashboardLayoutHeaderProps> = ({
  memberName,
  initials,
  gender,
  avatarUrl,
  onProfilePress,
  safeAreaTop,
}) => {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: safeAreaTop,
          paddingBottom: 4,
        },
      ]}
    >
      <View style={styles.topBar}>
        <View style={styles.leftContainer}>
          <Image
            source={require('../../assets/gymzLogo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <View style={styles.rightBar}>
          <NotificationBell />
          <TouchableOpacity activeOpacity={0.8} onPress={onProfilePress}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={[styles.avatarImage, { borderColor: theme.border }]}
              />
            ) : (
              <LinearGradient
                colors={designSystem.colors.gradients.brand}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>{initials}</Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
        </View>
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 0,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
    height: 82,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoImage: {
    width: 36,
    aspectRatio: 1,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    ...(Platform.OS === 'ios' ? {
      shadowColor: designSystem.shadows.sm.shadowColor,
      shadowOffset: designSystem.shadows.sm.shadowOffset,
      shadowOpacity: designSystem.shadows.sm.shadowOpacity,
      shadowRadius: designSystem.shadows.sm.shadowRadius,
    } : Platform.OS === 'android' ? {
      elevation: designSystem.shadows.sm.elevation,
    } : {
      boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)',
    }),
  },
  avatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
  },
  avatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
});

/** @deprecated Use DashboardLayoutHeader - alias for backwards compatibility */
export const DashboardHeader = DashboardLayoutHeader;
