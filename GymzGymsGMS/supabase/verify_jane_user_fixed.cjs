// Verify Jane's biometric data using signInWithPassword (updated API)
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aXefrNTxbVE";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
    const email = "jane@msafiristudios.com";
    const password = "jane@msafiristudios.com"; // per user request
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
        console.error('Sign-in error:', signInError);
        return;
    }
    console.log('Signed in as Jane, user ID:', signInData.user?.id);

    // Fetch biometric data from public.users (requires auth session)
    const { data, error } = await supabase
        .from('users')
        .select('id, email, height, weight, age, goal, calculated_bmi')
        .eq('email', email)
        .single();

    if (error) {
        console.error('Data fetch error:', error);
    } else {
        console.log('Jane biometric data:', data);
    }
}

main();
