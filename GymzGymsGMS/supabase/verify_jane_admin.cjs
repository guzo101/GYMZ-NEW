const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verifyAsAdmin() {
    console.log('--- ADMIN DATA VERIFICATION ---');

    // 1. Sign in as Admin
    console.log('Signing in as admin@Gymz.com...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'admin@Gymz.com',
        password: 'Admin@123'
    });

    if (authError) {
        console.error('Login Failed:', authError);
        return;
    }

    console.log('Login Success! User ID:', authData.user.id);

    // 2. Fetch Jane's data
    const janeEmail = 'jane@msafiristudios.com';
    console.log(`Searching for ${janeEmail}...`);
    const { data: jane, error: janeError } = await supabase
        .from('users')
        .select('id, email, name, metadata, weight, height, age, goal, primary_objective, calculated_bmi, gym_id')
        .eq('email', janeEmail)
        .maybeSingle();

    if (janeError) {
        console.error('Error fetching Jane:', janeError);
    } else if (!jane) {
        console.warn('Jane not found. Listing all users visible to admin:');
        const { data: allUsers } = await supabase.from('users').select('id, email, name').limit(10);
        console.table(allUsers);
    } else {
        console.log('Jane Found:');
        console.log(JSON.stringify(jane, null, 2));
    }
}

verifyAsAdmin();
