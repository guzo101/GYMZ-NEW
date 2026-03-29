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

        // Authenticate the caller
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('Missing Authorization header')

        const { data: { user: caller }, error: callerError } = await supabaseAdmin.auth.getUser(
            authHeader.replace('Bearer ', '')
        )
        if (callerError || !caller) {
            console.error('Auth check failed:', callerError);
            throw new Error('Unauthorized');
        }
        console.log('Caller authenticated:', caller.id);

        // Verify caller is an admin (gym admin or platform admin)
        const { data: profile } = await supabaseAdmin
            .from('users')
            .select('role, gym_id')
            .eq('id', caller.id)
            .single()

        if (profile?.role !== 'admin' && profile?.role !== 'super_admin' && profile?.role !== 'platform_admin') {
            throw new Error('Only administrators can onboard members via email.')
        }

        const body = await req.json()
        console.log('Request body:', JSON.stringify(body));
        const { gym_id, name, email, phone, plan_id, paid_at } = body

        // Fetch gym name for branding
        const { data: gymData } = await supabaseAdmin
            .from('gyms')
            .select('name')
            .eq('id', gym_id)
            .single()
        const gymName = gymData?.name || 'Gym'

        if (!email?.trim() || !name?.trim() || !gym_id || !plan_id || !paid_at) {
            console.error('Missing fields:', { email, name, gym_id, plan_id, paid_at });
            throw new Error('Missing required fields (email, name, gym_id, plan_id, paid_at).');
        }

        // Must onboard to the caller's gym unless platform/super admin
        if (profile.role === 'admin' && profile.gym_id !== gym_id) {
            throw new Error('You can only onboard members to your own gym.')
        }

        const normalizedEmail = email.trim().toLowerCase()

        // GMS_APP_URL = where invitees land after setting password
        const gmsUrl = Deno.env.get('GMS_APP_URL') || ''
        const redirectTo = gmsUrl && gmsUrl.startsWith('http')
            ? `${gmsUrl.replace(/\/$/, '')}/invite-complete`
            : undefined

        const baseOptions = {
            data: {
                name: name.trim(),
                role: 'member',
                gym_name: gymName
            },
        }
        const inviteOptions = redirectTo ? { ...baseOptions, redirectTo } : baseOptions

        let newUserId: string | null = null;
        let existingUser = false;

        // 1. Pre-check: see if the user already exists in the public.users table
        //    This avoids the invite flow entirely for already-registered members and
        //    prevents the paginated listUsers() bug (which only returns first ~50 users).
        const { data: existingPublicUser } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', normalizedEmail)
            .maybeSingle()

        if (existingPublicUser?.id) {
            newUserId = existingPublicUser.id;
            existingUser = true;
            console.log('User already exists in public.users, skipping invite. id:', newUserId);
        } else {
            // 2. Try to invite the user (new user path)
            let { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(normalizedEmail, inviteOptions)

            // Fallback: if redirect URL is invalid, retry without it
            if (inviteError && redirectTo && (
                inviteError.message?.toLowerCase().includes('redirect') ||
                inviteError.message?.toLowerCase().includes('url') ||
                inviteError.message?.toLowerCase().includes('invalid')
            )) {
                const retry = await supabaseAdmin.auth.admin.inviteUserByEmail(normalizedEmail, baseOptions)
                inviteData = retry.data
                inviteError = retry.error
            }

            if (inviteError) {
                if (
                    inviteError.message?.toLowerCase().includes('already') ||
                    inviteError.message?.toLowerCase().includes('registered') ||
                    inviteError.message?.toLowerCase().includes('exists')
                ) {
                    // User exists in auth but not in public.users — use targeted getUserByEmail
                    // IMPORTANT: Do NOT use listUsers() — it is paginated and only returns the
                    // first ~50 users, causing "unable to retrieve their ID" for larger gyms.
                    const { data: foundUserData, error: getUserError } = await supabaseAdmin.auth.admin.getUserByEmail(normalizedEmail)
                    if (getUserError || !foundUserData?.user) {
                        throw new Error('User already exists in auth, but unable to retrieve their ID. Please contact support.')
                    }
                    newUserId = foundUserData.user.id;
                    existingUser = true;
                    console.log('Existing auth user found via getUserByEmail, id:', newUserId);
                } else {
                    throw new Error(inviteError.message || 'Invite failed')
                }
            } else {
                newUserId = inviteData.user.id;
            }
        }

        // 2. Call the onboard_member_manually RPC
        console.log('Calling RPC onboard_member_manually for user:', newUserId);
        const { data: memberId, error: rpcError } = await supabaseAdmin.rpc('onboard_member_manually', {
            p_gym_id: gym_id,
            p_name: name.trim(),
            p_email: normalizedEmail,
            p_phone: phone || null,
            p_plan_id: plan_id,
            p_paid_at: new Date(paid_at).toISOString(),
            p_admin_id: caller.id,
            p_user_id: newUserId
        });

        if (rpcError) {
            console.error('RPC Error:', JSON.stringify(rpcError));
            throw new Error(`Failed to save member record: ${rpcError.message}`);
        }

        console.log('RPC succeeded, member_id:', memberId);

        return new Response(
            JSON.stringify({
                success: true,
                message: existingUser
                    ? 'Member onboarded successfully. They already have an account and can log in.'
                    : 'Invite email sent. The member will receive a link to set their password.',
                existing_user: existingUser,
                member_id: memberId
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
    } catch (err: any) {
        console.error('Function error:', err.message);
        return new Response(
            JSON.stringify({ error: err.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
