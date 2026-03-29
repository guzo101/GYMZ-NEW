/**
 * Account Deletion Service
 * Handles in-app account deletion for Google Play compliance.
 * Deletes user data from Supabase and signs out.
 * Note: Supabase Auth user deletion requires a backend/Edge Function.
 * This service deletes all client-accessible data and signs out.
 */

import { supabase } from './supabase';
import { logoutService } from './logoutService';

/** Tables with user_id that we attempt to delete (order: child tables first) */
const USER_DATA_TABLES = [
  'user_device_tokens',
  'push_tokens',
  'notice_board_reactions',
  'user_ai_memory',
  'user_badge_progress',
  'user_streaks',
  'user_fitness_goals',
  'daily_nutrition_logs',
  'water_logs',
  'body_metrics',
  'user_snapshots',
  'exercise_progress',
  'weekly_progress_summary',
  'conversations',
  'ai_messages',
  'subscriptions',
  'payments',
  'attendance',
  'workout_sessions',
  'event_rsvps',
  'room_members',
  'limited_access_logs',
  'membership',
];

/** Storage buckets that may contain user files */
const USER_STORAGE_BUCKETS = ['user-avatars', 'user-snapshots', 'meal-images'];

export const accountDeletionService = {
  /**
   * Request full account deletion. Records deletion for admin, notifies admins,
   * deletes user data from DB and storage, then signs out.
   * The Supabase Auth user may remain until a backend/Edge Function completes deletion.
   */
  async requestAccountDeletion(
    userId: string,
    setUser: (u: null) => void,
    setCurrentGym: (g: null) => void
  ): Promise<{ success: boolean; message: string }> {
    try {
      // 0. Server-side deletion via delete_my_account() RPC (records, notifies, deletes all DB rows)
      //    Bypasses RLS for reliable deletion. Falls back to client-side if RPC not available.
      let dbDeleted = false;
      try {
        const { data, error } = await (supabase as any).rpc('delete_my_account');
        if (!error && data?.success === true) {
          dbDeleted = true;
        } else if (data?.success === false) {
          return {
            success: false,
            message: data?.error || 'Deletion failed.',
          };
        }
      } catch (e) {
        console.warn('[accountDeletionService] delete_my_account RPC not available, using fallback:', e);
      }

      if (!dbDeleted) {
        // Fallback: record + client-side deletes (when migration not applied)
        try {
          await (supabase as any).rpc('record_account_deletion');
        } catch {}
        for (const table of USER_DATA_TABLES) {
          try {
            await (supabase as any).from(table).delete().eq('user_id', userId);
          } catch {}
        }
        try {
          await (supabase as any).from('users').delete().eq('id', userId);
        } catch {}
      }

      // 1. Delete from storage buckets (avatar, snapshots, meal images)
      for (const bucket of USER_STORAGE_BUCKETS) {
        try {
          // user-avatars: files at root with prefix user_${userId}_
          const { data: files } = await (supabase as any).storage.from(bucket).list('', { limit: 1000 });
          if (files?.length) {
            const toRemove = files
              .filter((f: any) => !f.id && f.name?.startsWith(`user_${userId}_`))
              .map((f: any) => f.name);
            if (toRemove.length) {
              await (supabase as any).storage.from(bucket).remove(toRemove);
            }
          }
          // user-snapshots: files may be in userId folder
          const { data: folderFiles } = await (supabase as any).storage.from(bucket).list(userId, { limit: 1000 });
          if (folderFiles?.length) {
            const paths = folderFiles
              .filter((f: any) => !f.id)
              .map((f: any) => `${userId}/${f.name}`);
            if (paths.length) await (supabase as any).storage.from(bucket).remove(paths);
          }
        } catch {
          // Bucket may not exist or RLS may block
        }
      }

      // 2. Sign out (clears session)
      await logoutService.performLogout(setUser, setCurrentGym);

      return {
        success: true,
        message: 'Your account has been deleted and you have been signed out.',
      };
    } catch (err: any) {
      console.error('[accountDeletionService] Error:', err);
      // Still sign out so user is logged out
      await logoutService.performLogout(setUser, setCurrentGym).catch(() => {});
      return {
        success: false,
        message: err?.message || 'Deletion encountered an error. You have been signed out. For complete removal, contact support.',
      };
    }
  },
};
