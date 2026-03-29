/**
 * Scan feedback: short click when barcode is read, then success or error after result.
 * Uses haptics on native; safe no-op on web (GMS uses Web Audio for sounds).
 */
import { useCallback } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export function useScanFeedback() {
  const playScanClick = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
  }, []);

  const playScanSuccess = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (_) {}
  }, []);

  const playScanError = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch (_) {}
  }, []);

  return { playScanClick, playScanSuccess, playScanError };
}
