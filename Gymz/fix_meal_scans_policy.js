require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
// We need the service role key to bypass RLS and execute SQL, not the anon key!
// Let's check for it or fallback to anon key with an RPC.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixPolicies() {
    console.log('Adding INSERT policy for meal_scans...');

    // First try standard insert with service_role if available
    const { data: rpcData, error: rpcError } = await supabase.rpc('execute_sql', {
        sql: `
        CREATE POLICY "Users can insert their own meal scans" 
        ON public.meal_scans 
        FOR INSERT 
        WITH CHECK (auth.uid() = user_id);
        `
    });

    if (rpcError) {
        console.error('RPC Error (might not exist):', rpcError.message);

        // Try direct SQL if we have pg connections (we don't from client), 
        // so we must instruct user to do it in Supabase Dashboard if this fails.
        console.log('\n--- IMPORTANT ---');
        console.log('If this script fails, please go to your Supabase Dashboard -> SQL Editor and run:');
        console.log('CREATE POLICY "Users can insert their own meal scans" ON public.meal_scans FOR INSERT WITH CHECK (auth.uid() = user_id);');
    } else {
        console.log('Policy added successfully via execute_sql RPC!');
    }
}

fixPolicies();
