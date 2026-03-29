import { supabase } from './supabase';

/**
 * Save Expo push token to Supabase for GMS to send push notifications.
 * Call when push token is received and user is logged in.
 */
export async function savePushToken(token: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return;

  const { error } = await (supabase as any)
    .from('user_device_tokens')
    .upsert(
      {
        user_id: session.user.id,
        token,
        device_info: { platform: 'expo' },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,token' }
    );

  if (error) {
    console.warn('[PushToken] Save failed:', error.message);
    throw error;
  }
}
