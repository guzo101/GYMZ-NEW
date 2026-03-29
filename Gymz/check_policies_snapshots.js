/**
 * Dev script: Check policy snapshots. Uses SUPABASE_SERVICE_ROLE_KEY from env.
 * Run: SUPABASE_SERVICE_ROLE_KEY=<key> node check_policies_snapshots.js
 * Excluded from EAS builds via .easignore.
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error("Error: SUPABASE_SERVICE_ROLE_KEY must be set in environment. Do not hardcode the service_role key.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkPolicies() {
    const { data, error } = await supabase.rpc('get_policies', { table_name: 'user_snapshots' });
    if (error) {
        // Fallback: use a direct query to pg_policies if the RPC doesn't exist
        console.log('RPC get_policies failed, try direct query...');
        const { data: policies, error: polError } = await supabase
            .from('pg_policies') // This likely won't work due to permissions even with service key, usually we need an RPC
            .select('*')
            .eq('tablename', 'user_snapshots');

        if (polError) {
            console.error('Could not fetch policies:', polError);
            // Let's try to just check if we can update with service role
            console.log('Checking if service role can see policies via information_schema...');
        } else {
            console.log('Policies:', policies);
        }
    } else {
        console.log('Policies:', data);
    }
}

// Another way to check: try to find the policy in pg_catalog
async function checkPgPolicies() {
    const { data, error } = await supabase.from('room_management_settings').select('*').limit(1); // just a dummy to check if we can query

    const { data: pols, error: err } = await supabase.rpc('exec_sql', {
        sql_query: "SELECT * FROM pg_policies WHERE tablename = 'user_snapshots';"
    });

    if (err) {
        console.error('exec_sql failed:', err);
    } else {
        console.log('Policies for user_snapshots:', pols);
    }
}

checkPgPolicies();
