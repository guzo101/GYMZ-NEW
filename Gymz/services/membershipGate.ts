/**
 * Access Gate — single source of truth: fetch membership for logged-in user and gym/access_mode.
 * No caching; each call is a fresh read. Used only by AccessGateScreen.
 */

import { supabase } from './supabase';

export type MembershipStatus = 'pending' | 'active' | 'rejected' | 'cancelled';

export interface MembershipForGate {
  id: string;
  user_id: string;
  gym_id: string;
  access_mode: string;
  membership_status: MembershipStatus;
  approved: boolean;
  approved_at: string | null;
  unique_member_id: string | null;
  paid_at: string | null;
  calibration_required: boolean;
  calibration_completed: boolean;
  calibration_completed_at: string | null;
  /** True when membership was found for a different gym than user's context (multi-gym, stale). Caller should sync. */
  gym_context_mismatch?: boolean;
}

export async function fetchMembershipForGate(
  userId: string,
  gymId: string,
  accessMode: string
): Promise<MembershipForGate | null> {
  const { data, error } = await (supabase as any).rpc('get_membership_for_gate', {
    p_user_id: userId,
    p_gym_id: gymId,
    p_access_mode: accessMode,
  });
  if (error) {
    console.error('[membershipGate] get_membership_for_gate error:', error);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return row as MembershipForGate;
}

export async function setCalibrationCompleted(
  userId: string,
  gymId: string,
  accessMode: string
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await (supabase as any).rpc('set_membership_calibration_completed', {
    p_user_id: userId,
    p_gym_id: gymId,
    p_access_mode: accessMode,
  });
  if (error) return { success: false, error: error?.message };
  const result = data as { success?: boolean; error?: string };
  return { success: result?.success === true, error: result?.error };
}

/**
 * Sync user's gym_id and access_mode from membership (e.g. when gym_context_mismatch).
 * Call after get_membership_for_gate returns gym_context_mismatch=true.
 */
export async function syncUserGymContextFromMembership(
  userId: string,
  gymId: string,
  accessMode: string
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await (supabase as any).rpc('sync_user_gym_context_from_membership', {
    p_user_id: userId,
    p_gym_id: gymId,
    p_access_mode: accessMode,
  });
  if (error) return { success: false, error: error?.message };
  const result = data as { success?: boolean; error?: string };
  return { success: result?.success === true, error: result?.error };
}
