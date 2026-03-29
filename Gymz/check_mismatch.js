const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkMismatch() {
    const placeholderId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const realId = '66874288-028a-495b-b98a-ceddf94876b6';

    console.log(`Checking users with placeholder ID: ${placeholderId}`);
    const { count, error } = await supabase
        .from('users')
        .select('id', { count: 'exact' })
        .eq('gym_id', placeholderId);

    if (error) console.error('Error:', error);
    else console.log(`Users stuck with placeholder: ${count}`);

    console.log(`Checking users with real ID: ${realId}`);
    const { count: realCount } = await supabase
        .from('users')
        .select('id', { count: 'exact' })
        .eq('gym_id', realId);

    console.log(`Users with real ID: ${realCount}`);
}

checkMismatch();
