const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verify() {
    console.log('--- VERIFYING CONSOLIDATION ---');

    // 1. Check user counts for Sweat Factory
    const sweatGymId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const { data: sweatUsers, count, error } = await supabase
        .from('users')
        .select('id', { count: 'exact' })
        .eq('gym_id', sweatGymId);

    if (error) console.error('Error:', error);
    else console.log(`Total users in Sweat Factory Gym: ${count}`);

    // 2. Sample migrated data
    const { data: samples } = await supabase
        .from('users')
        .select('name, email, height, weight, age, membership_status')
        .eq('gym_id', sweatGymId)
        .limit(5);

    console.log('\nSample Migrated Users:');
    console.table(samples);

    // 3. Count remaining orphaned users
    const { count: orphanCount } = await supabase
        .from('users')
        .select('id', { count: 'exact' })
        .is('gym_id', null);

    console.log(`\nRemaining users without gym_id: ${orphanCount || 0}`);
}

verify();
