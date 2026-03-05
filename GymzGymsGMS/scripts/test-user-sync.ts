import { createClient } from '@supabase/supabase-js';

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUserSync() {
    console.log('🔍 Testing User Sync Status...\n');

    try {
        // 1. Check auth.users count
        const { count: authCount, error: authError } = await supabase.rpc('count_auth_users');

        // 2. Check public.users count
        const { count: publicCount, error: publicError } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true });

        console.log('📊 User Counts:');
        console.log(`   Auth Users: ${authCount || 'N/A'}`);
        console.log(`   Public Users: ${publicCount || 'N/A'}`);

        // 3. Find zombie users (in auth but not in public)
        const { data: authUsers, error: authUsersError } = await supabase.auth.admin.listUsers();

        if (authUsers && authUsers.users) {
            console.log(`\n🔍 Checking ${authUsers.users.length} auth users for sync status...`);

            const zombies = [];

            for (const authUser of authUsers.users) {
                const { data: publicUser, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', authUser.id)
                    .maybeSingle();

                if (!publicUser) {
                    zombies.push({
                        id: authUser.id,
                        email: authUser.email,
                        created_at: authUser.created_at,
                        metadata: authUser.user_metadata
                    });
                }
            }

            if (zombies.length > 0) {
                console.log(`\n⚠️  Found ${zombies.length} ZOMBIE USERS (in auth.users but NOT in public.users):`);
                zombies.forEach((zombie, idx) => {
                    console.log(`\n   ${idx + 1}. ${zombie.email}`);
                    console.log(`      ID: ${zombie.id}`);
                    console.log(`      Created: ${zombie.created_at}`);
                    console.log(`      Metadata: ${JSON.stringify(zombie.metadata, null, 2)}`);
                });
            } else {
                console.log('\n✅ No zombie users found! All auth users are synced to public.users');
            }
        }

        // 4. Check if the trigger exists
        console.log('\n🔧 Checking Database Trigger Status...');
        const { data: triggers, error: triggerError } = await supabase.rpc('check_user_trigger');

        if (triggerError) {
            console.log('   ⚠️  Unable to check trigger status (need admin access)');
        } else {
            console.log('   ✅ Trigger check complete');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Create helper RPC functions if they don't exist
async function setupHelperFunctions() {
    console.log('Setting up helper functions...\n');

    // This would need to be run with service_role key
    // Just documenting what we need
    const sql = `
    -- Helper function to count auth users
    CREATE OR REPLACE FUNCTION count_auth_users()
    RETURNS INTEGER AS $$
    BEGIN
      RETURN (SELECT COUNT(*) FROM auth.users);
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    
    -- Helper function to check trigger status
    CREATE OR REPLACE FUNCTION check_user_trigger()
    RETURNS TABLE(trigger_name TEXT, event TEXT, enabled TEXT) AS $$
    BEGIN
      RETURN QUERY
      SELECT 
        t.trigger_name::TEXT, 
        t.event_manipulation::TEXT,
        t.status::TEXT
      FROM information_schema.triggers t
      WHERE t.trigger_name = 'on_auth_user_created';
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;

    console.log('SQL to run manually:');
    console.log(sql);
}

testUserSync();
