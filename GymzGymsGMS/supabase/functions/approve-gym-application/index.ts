import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // 1. Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                },
            }
        )

        // 2. Verify Caller (Platform Admin only)
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error('Missing Authorization header')
        }

        const { data: { user: caller }, error: callerError } = await supabaseClient.auth.getUser(
            authHeader.replace('Bearer ', '')
        )
        if (callerError || !caller) throw new Error('Unauthorized')

        const { data: profile } = await supabaseClient
            .from('users')
            .select('role')
            .eq('id', caller.id)
            .single()

        if (profile?.role !== 'platform_admin') {
            throw new Error('Unauthorized: Platform Admin only')
        }

        // 3. Process Approval
        const { applicationId } = await req.json()
        if (!applicationId) throw new Error('Missing application ID')

        // Fetch application details
        const { data: app, error: appError } = await supabaseClient
            .from('gym_applications')
            .select('*')
            .eq('id', applicationId)
            .single()

        if (appError || !app) throw new Error('Application not found')
        if (app.status === 'approved') throw new Error('Application already approved')
        if (!app.password) throw new Error('No password provided in application')

        // A. Create Auth User
        const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
            email: app.email,
            password: app.password,
            email_confirm: true,
            user_metadata: {
                name: app.owner_name,
                role: 'admin'
            }
        })

        if (createError) {
            // If user exists, we might want to just update them or error
            // For this flow, we assume it's a new user. 
            // If they exist, createError.message will say "User already registered"
            throw createError
        }

        // B. Provision Gym and Profile
        const { data: gymId, error: provisionError } = await supabaseClient.rpc('provision_new_gym', {
            p_auth_id: newUser.user.id,
            p_gym_name: app.gym_name,
            p_owner_email: app.email,
            p_owner_name: app.owner_name,
            p_location: app.location || "",
            p_feature_flags: app.feature_flags || {}
        })

        if (provisionError) throw provisionError

        // C. Update Application status
        const { error: updateError } = await supabaseClient
            .from('gym_applications')
            .update({ status: 'approved' })
            .eq('id', applicationId)

        if (updateError) throw updateError

        return new Response(
            JSON.stringify({ success: true, gymId, userId: newUser.user.id }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (err: any) {
        return new Response(
            JSON.stringify({ error: err.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
