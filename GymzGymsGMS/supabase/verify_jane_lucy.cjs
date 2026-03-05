const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verifyAsLucy() {
    console.log('--- LUCY DATA VERIFICATION ---');

    // 1. Sign in as Lucy
    console.log('Signing in as lucy@msafiristudios.com...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'lucy@msafiristudios.com',
        password: 'lucy123'
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
        console.warn('Jane not found. Listing users visible to Lucy:');
        const { data: allUsers } = await supabase.from('users').select('id, email, name, role').limit(20);
        console.table(allUsers);
    } else {
        console.log('Jane Found:');
        console.log(JSON.stringify(jane, null, 2));

        // Check if data is indeed missing
        if (!jane.height || !jane.weight) {
            console.log('⚠️ Jane is missing height/weight data in the columns, but let check metadata.');
            console.log('Metadata:', JSON.stringify(jane.metadata, null, 2));
        }
    }
}

verifyAsLucy();
