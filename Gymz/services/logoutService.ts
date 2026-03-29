/**
 * Centralized Logout Service — Single Source of Truth
 * All logout logic lives here. Screens must call useAuth().logout() only.
 * No screen implements its own logout logic.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const USER_STORAGE_KEY = 'auth_user';
const SESSION_EXPIRY_KEY = 'auth_expiry';

/** Auth-related cache key patterns to clear on logout */
const AUTH_KEY_PATTERNS = [
  USER_STORAGE_KEY,
  SESSION_EXPIRY_KEY,
  /^sb-/,
  /auth-token/,
  /^Gymz_/,
  /^profile_data_/,
  /^dashboard_data_/,
];

function keyMatchesPattern(key: string, pattern: string | RegExp): boolean {
  if (typeof pattern === 'string') return key === pattern;
  return pattern.test(key);
}

export const logoutService = {
  /**
   * Perform full logout. Clears auth, cache, and notifies auth state.
   * Call setUser(null) and setCurrentGym(null) FIRST so navigator re-renders immediately.
   */
  async performLogout(
    setUser: (u: null) => void,
    setCurrentGym: (g: null) => void
  ): Promise<void> {
    setUser(null);
    setCurrentGym(null);

    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[logoutService] signOut error:', e);
    }

    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const toRemove = allKeys.filter((k) =>
        AUTH_KEY_PATTERNS.some((p) => keyMatchesPattern(k, p))
      );
      if (toRemove.length > 0) {
        await AsyncStorage.multiRemove(toRemove);
      }
    } catch (e) {
      console.warn('[logoutService] AsyncStorage clear error:', e);
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      const lsKeys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && (k.startsWith('sb-') || k.includes('auth-token'))) lsKeys.push(k);
      }
      lsKeys.forEach((k) => window.localStorage.removeItem(k));
    }
  },
};
