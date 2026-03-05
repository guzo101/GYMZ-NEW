import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('Missing Authorization header')

        const { data: { user: caller }, error: callerError } = await supabaseAdmin.auth.getUser(
            authHeader.replace('Bearer ', '')
        )
        if (callerError || !caller) throw new Error('Unauthorized')

        const { data: profile } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('id', caller.id)
            .single()

        if (profile?.role !== 'platform_admin' && profile?.role !== 'super_admin') {
            throw new Error('Only platform administrators can send invite emails.')
        }

        const { email, name, gym_id, gym_name } = await req.json()
        if (!email?.trim() || !name?.trim() || !gym_id) {
            throw new Error('Email, name, and gym_id are required.')
        }

        const normalizedEmail = email.trim().toLowerCase()

        // GMS_APP_URL = where invitees land after setting password (e.g. https://your-gms.vercel.app)
        // Uses /invite-complete so mobile users get redirected to gymz-app://
        // redirectTo must be in Supabase Auth → URL Configuration → Redirect URLs
        const gmsUrl = Deno.env.get('GMS_APP_URL') || ''
        const redirectTo = gmsUrl && gmsUrl.startsWith('http')
            ? `${gmsUrl.replace(/\/$/, '')}/invite-complete`
            : undefined

        const baseOptions = {
            data: {
                gym_id,
                name: name.trim(),
                role: 'admin',
                gym_name: gym_name || '',
            },
        }
        const inviteOptions = redirectTo ? { ...baseOptions, redirectTo } : baseOptions

        let { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(normalizedEmail, inviteOptions)

        // Fallback: if redirect URL is invalid (not in allowlist), retry without it so email still sends
        if (error && redirectTo && (
            error.message?.toLowerCase().includes('redirect') ||
            error.message?.toLowerCase().includes('url') ||
            error.message?.toLowerCase().includes('invalid')
        )) {
            const { error: retryError } = await supabaseAdmin.auth.admin.inviteUserByEmail(normalizedEmail, baseOptions)
            error = retryError
        }

        if (error) {
            if (
                error.message?.toLowerCase().includes('already') ||
                error.message?.toLowerCase().includes('registered') ||
                error.message?.toLowerCase().includes('exists')
            ) {
                return new Response(
                    JSON.stringify({
                        success: true,
                        message: 'User already has an account. They can log in now.',
                        existing_user: true,
                    }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
                )
            }
            // Include full error so OAC can surface it (e.g. redirect URL not in allowlist, SMTP, etc.)
            throw new Error(error.message || 'Invite failed')
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Invite email sent. They will receive a link to set their password and access the GMS.',
                existing_user: false,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
    } catch (err: any) {
        return new Response(
            JSON.stringify({ error: err.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
