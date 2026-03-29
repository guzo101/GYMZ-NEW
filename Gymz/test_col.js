const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testColumn() {
    console.log('--- TESTING COLUMN: highest_streak_count ---');
    const { data, error } = await supabase.from('user_behavior_metrics').select('highest_streak_count').limit(1);
    if (error) {
        console.log('COL_CHECK: highest_streak_count DOES NOT EXIST or other error:', error.message);
    } else {
        console.log('COL_CHECK: highest_streak_count EXISTS');
    }
}

testColumn();
