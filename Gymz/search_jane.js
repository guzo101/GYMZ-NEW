const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function searchJane() {
    console.log('--- SEARCHING FOR JANE ---');
    const { data, error } = await supabase
        .from('users')
        .select('id, email, name, role, gym_id')
        .ilike('email', '%jane%');

    if (error) {
        console.error('Search Error:', error);
    } else {
        console.log(`Found ${data.length} users:`);
        console.table(data);
    }
}

searchJane();
