/**
 * Pre-App Back Navigation Hook
 * Returns onBack: if can go back, goBack(); otherwise logout (exit to Sign In).
 * Use on every pre-app screen for deterministic back behavior.
 */

import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import { useAuth } from './useAuth';

export function usePreAppBack() {
  const navigation = useNavigation<any>();
  const { logout } = useAuth();

  const onBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      logout();
    }
  }, [navigation, logout]);

  return { onBack };
}
