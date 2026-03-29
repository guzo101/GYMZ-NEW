import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: callerError } = await supabaseAdmin.auth.getUser(token)
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { user_id, title, body, data: customData } = await req.json()

    const normalizedTitle = typeof title === 'string' ? title.trim() : ''
    const pushTitle = normalizedTitle.length > 0 ? normalizedTitle : 'Admin'

    if (!user_id || !body) {
      return new Response(JSON.stringify({ error: 'user_id and body are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    // Optional: pass through so the app can open a specific screen on tap (e.g. action_url, event_id, screen)
    const data = customData && typeof customData === 'object' ? customData : undefined

    // Verify caller is gym admin for this member
    const { data: targetUser } = await supabaseAdmin
      .from('users')
      .select('gym_id')
      .eq('id', user_id)
      .single()

    if (!targetUser?.gym_id) {
      return new Response(JSON.stringify({ error: 'Target user not found or has no gym' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: adminProfile } = await supabaseAdmin
      .from('users')
      .select('role, gym_id')
      .eq('id', caller.id)
      .single()

    const isPlatformAdmin = adminProfile?.role === 'platform_admin' || adminProfile?.role === 'super_admin'
    const isGymAdmin = adminProfile?.gym_id === targetUser.gym_id && ['admin', 'owner', 'staff'].includes(adminProfile?.role || '')

    if (!isPlatformAdmin && !isGymAdmin) {
      return new Response(JSON.stringify({ error: 'Only gym admins can send push to their members' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch push tokens for the user
    const { data: tokens, error: tokensError } = await supabaseAdmin
      .from('user_device_tokens')
      .select('token')
      .eq('user_id', user_id)

    if (tokensError || !tokens?.length) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No push tokens registered for this user. Ask them to open the app and enable notifications.',
        sent: 0,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const messages = tokens.map(({ token }) => ({
      to: token,
      title: pushTitle,
      body: String(body),
      sound: 'default' as const,
      // Android: make sure it lands in the channel we create in-app
      channelId: 'default',
      // Hint delivery urgency (Expo maps to Android priority/APNs headers where possible)
      priority: 'high' as const,
      ...(data && Object.keys(data).length > 0 && { data }),
    }))

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(messages.length === 1 ? messages[0] : messages),
    })

    const rawText = await res.text()
    let parsed: unknown = null
    try {
      parsed = rawText ? JSON.parse(rawText) : null
    } catch {
      parsed = rawText
    }

    if (!res.ok) {
      console.error('[send-push] Expo API error:', res.status, rawText)
      return new Response(JSON.stringify({
        success: false,
        error: `Expo push failed: ${res.status}`,
        expo_status: res.status,
        expo_response: parsed,
        sent: 0,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const ticketCount = Array.isArray((parsed as any)?.data) ? (parsed as any).data.length : 1

    return new Response(JSON.stringify({
      success: true,
      sent: ticketCount,
      message: `Push sent to ${ticketCount} device(s)`,
      expo_response: parsed,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[send-push] Error:', err)
    return new Response(JSON.stringify({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
