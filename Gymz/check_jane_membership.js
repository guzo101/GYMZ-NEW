const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkMembershipTable() {
    const janeEmail = 'jane@msafiristudios.com';
    console.log(`--- CHECKING MEMBERSHIPS FOR ${janeEmail} ---`);

    // Get user ID first
    const { data: userData } = await supabase.from('users').select('id').eq('email', janeEmail).single();

    if (!userData) {
        console.log('User not found in public.users');
        return;
    }

    const { data: memberships, error } = await supabase
        .from('memberships')
        .select('*')
        .eq('user_id', userData.id);

    if (error) {
        console.error('Memberships Table Error:', error);
    } else {
        console.log(`Found ${memberships.length} membership records:`);
        console.table(memberships);
    }
}

checkMembershipTable();
