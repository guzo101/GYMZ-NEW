/**
 * Auto-Nudge Service (Round 30)
 * Handles scheduling of 5x daily "Caring Friend" push notifications.
 */

import * as Notifications from 'expo-notifications';
import { GLOBAL_NUDGES } from './nudgeLibrary';
import { Platform } from 'react-native';

const NUDGE_IDS = [
    'auto_nudge_1',
    'auto_nudge_2',
    'auto_nudge_3',
    'auto_nudge_4',
    'auto_nudge_5',
];

// Ranges must match nudgeLibrary sections: Morning 0-39, Midday 40-79, Afternoon 80-119, Evening 120-159, Night 160+
const SLOTS = [
    { hour: 9, minute: 15, title: "Morning Fuel ☕", range: [0, 39] },
    { hour: 12, minute: 45, title: "Lunch Check 🥗", range: [40, 79] },
    { hour: 15, minute: 30, title: "Afternoon Hype ⚡", range: [80, 119] },
    { hour: 18, minute: 45, title: "Evening Focus 🥩", range: [120, 159] },
    { hour: 21, minute: 15, title: "Night Check 💤", range: [160, 217] },
];

export const autoNudgeService = {
    /**
     * Initializes or refreshes all 5 daily auto-nudges.
     * Picks messages from the correct time-of-day range so titles match body content.
     */
    async initAutoNudges(gender: 'male' | 'female' | 'other' | null | undefined) {
        // Guard: Notifications are not supported on web platform
        if (Platform.OS === 'web') {
            console.log('[AutoNudge] Skipping notification scheduling on web platform');
            return;
        }

        try {
            console.log('[AutoNudge] Refreshing 5x daily personality nudges...');

            // 1. Cancel existing auto-nudges to avoid duplicates
            await this.cancelAllAutoNudges();

            const g = gender === 'female' ? 'female' : 'male';
            const library = GLOBAL_NUDGES[g];

            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), 0, 0);
            const diff = now.getTime() - startOfDay.getTime();
            const oneDay = 1000 * 60 * 60 * 24;
            const dayOfYear = Math.floor(diff / oneDay);

            // 2. Schedule each slot with time-appropriate messages only
            for (let i = 0; i < SLOTS.length; i++) {
                const slot = SLOTS[i];
                const id = NUDGE_IDS[i];
                const [rangeStart, rangeEnd] = slot.range;
                const rangeSize = Math.min(rangeEnd, library.length - 1) - rangeStart + 1;

                // Pick from this slot's range only (Morning→breakfast, Lunch→lunch, etc.)
                const messageIndex = rangeStart + (dayOfYear * SLOTS.length + i) % Math.max(1, rangeSize);
                const body = library[messageIndex];

                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: slot.title,
                        body: body,
                        sound: true,
                        priority: Notifications.AndroidNotificationPriority.HIGH,
                        ...(Platform.OS === 'android' && { channelId: 'default' }),
                    },
                    trigger: {
                        type: Notifications.SchedulableTriggerInputTypes.DAILY,
                        hour: slot.hour,
                        minute: slot.minute,
                    } as any,
                    identifier: id,
                });
            }

            console.log('[AutoNudge] 5 daily nudges scheduled successfully.');
        } catch (error) {
            console.error('[AutoNudge] Error scheduling nudges:', error);
            // Don't throw - this is a background service and shouldn't break the app
        }
    },

    /**
     * Cancels all scheduled auto-nudges.
     */
    async cancelAllAutoNudges() {
        // Guard: Notifications are not supported on web platform
        if (Platform.OS === 'web') {
            return;
        }

        try {
            await Promise.all(NUDGE_IDS.map(id => Notifications.cancelScheduledNotificationAsync(id)));
        } catch (err) {
            console.warn('[AutoNudge] Error canceling nudges:', err);
        }
    },

};
