import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptic Feedback Service
 * Provides tactile feedback for user interactions
 */
export const hapticService = {
    /**
     * Light impact - for subtle interactions like button hovers
     */
    light() {
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    },

    /**
     * Medium impact - for standard button presses
     */
    medium() {
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
    },

    /**
     * Heavy impact - for important actions like posting or joining
     */
    heavy() {
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }
    },

    /**
     * Success notification - for completed actions
     */
    success() {
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    },

    /**
     * Error notification - for failed actions
     */
    error() {
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    },

    /**
     * Warning notification - for caution messages
     */
    warning() {
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
    },

    /**
     * Selection change - for picking options or scrolling through items
     */
    selection() {
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
            Haptics.selectionAsync();
        }
    },
};
