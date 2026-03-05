/**
 * Fix: Associate admin gymz@msafiristudios.com with "The Sweat Factory" gym.
 * 
 * Problem: The admin's gym_id is null in the users table, which causes:
 *   1. Login rejection: "SECURITY ALERT: Your account is not associated with a gym"
 *   2. Event creation blocked: "Your account is not associated with a gym"
 * 
 * Solution: Set gym_id = '66874288-028a-495b-b98a-ceddf94876b6' (The Sweat Factory)
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";

const GYM_ID = '66874288-028a-495b-b98a-ceddf94876b6'; // The Sweat Factory
const ADMIN_EMAIL = 'gymz@msafiristudios.com';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fixAdminGym() {
    console.log(`\n🔍 Checking admin: ${ADMIN_EMAIL}`);
    console.log(`🏋️ Target gym: The Sweat Factory (${GYM_ID})\n`);

    // Step 1: Sign in as the admin to bypass RLS
    const password = process.argv[2];
    if (!password) {
        console.error('❌ Usage: node fix_admin_gym.cjs <admin_password>');
        console.error('   The admin password is required to authenticate and update the profile.');
        process.exit(1);
    }

    console.log('🔑 Authenticating as admin...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: ADMIN_EMAIL,
        password: password
    });

    if (authError) {
        console.error(`❌ Auth failed: ${authError.message}`);
        process.exit(1);
    }

    const userId = authData.user.id;
    console.log(`✅ Authenticated. User ID: ${userId}`);

    // Step 2: Check current profile
    const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('id, email, role, gym_id, name')
        .eq('id', userId)
        .single();

    if (profileError) {
        console.error(`❌ Profile fetch failed: ${profileError.message}`);
        await supabase.auth.signOut();
        process.exit(1);
    }

    console.log('\n📋 Current profile:');
    console.log(`   Name:   ${profile.name}`);
    console.log(`   Email:  ${profile.email}`);
    console.log(`   Role:   ${profile.role}`);
    console.log(`   Gym ID: ${profile.gym_id || '❌ NULL (this is the problem!)'}`);

    if (profile.gym_id === GYM_ID) {
        console.log('\n✅ gym_id is already correctly set! No fix needed.');
        await supabase.auth.signOut();
        return;
    }

    // Step 3: Update gym_id
    console.log(`\n🔧 Updating gym_id to: ${GYM_ID}`);
    const { data: updated, error: updateError } = await supabase
        .from('users')
        .update({ gym_id: GYM_ID })
        .eq('id', userId)
        .select('id, email, role, gym_id');

    if (updateError) {
        console.error(`❌ Update failed: ${updateError.message}`);
        await supabase.auth.signOut();
        process.exit(1);
    }

    if (updated && updated.length > 0) {
        console.log(`\n✅ SUCCESS! Profile updated:`);
        console.log(`   Email:  ${updated[0].email}`);
        console.log(`   Role:   ${updated[0].role}`);
        console.log(`   Gym ID: ${updated[0].gym_id}`);
        console.log('\n🎉 The admin can now log in and create events!');
    } else {
        console.log('⚠️  Update returned no rows. RLS may have blocked the update.');
        console.log('   You may need to run this from the Supabase Dashboard SQL editor:');
        console.log(`   UPDATE public.users SET gym_id = '${GYM_ID}' WHERE email = '${ADMIN_EMAIL}';`);
    }

    await supabase.auth.signOut();
}

fixAdminGym().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});
