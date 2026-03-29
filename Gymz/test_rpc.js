const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testRPC() {
    const userId = "a5976b91-4c17-4861-a185-5ca739c9f041"; // Jane Knows ID from previous files if I recall
    // If not, I'll try to find a user ID
    const { data: users } = await supabase.from('users').select('id').limit(1);
    const testId = users && users.length > 0 ? users[0].id : userId;

    console.log(`--- TESTING RPC for user ${testId} ---`);
    const dateStr = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase.rpc('get_unified_app_data', {
        p_user_id: testId,
        p_date: dateStr
    });

    if (error) {
        console.error('RPC NETWORK ERROR:', error.message);
    } else if (data.error) {
        console.error('SQL ERROR from RPC:', data.error);
    } else {
        console.log('RPC SUCCESS. Result keys:', Object.keys(data));
        console.log('Profile keys:', Object.keys(data.profile || {}));
    }
}

testRPC();
