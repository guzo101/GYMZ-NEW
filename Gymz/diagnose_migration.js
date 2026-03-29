const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function diagnose() {
    console.log('--- SCHEMA INFO ---');
    // Since I can't query information_schema easily via PostgREST, I'll try to infer from a select result
    const { data: users, error } = await supabase.from('users').select('*').limit(1);
    if (error) {
        console.error('Error fetching users:', error);
    } else if (users && users.length > 0) {
        const sample = users[0];
        console.log('Sample User Keys:', Object.keys(sample));
        console.log('Sample Values & Types:');
        ['age', 'height', 'weight', 'gender', 'goal'].forEach(key => {
            console.log(`${key}: ${sample[key]} (type: ${typeof sample[key]})`);
        });
    } else {
        console.log('No users found to sample.');
    }

    console.log('\n--- SAMPLING PROBLEMATIC DATA ---');
    const { data: samples, error: sampleErr } = await supabase
        .from('users')
        .select('email, age, height, weight')
        .not('age', 'is', null)
        .limit(10);

    if (sampleErr) {
        console.error('Error sampling data:', sampleErr);
    } else {
        console.log('Samples with non-null age:');
        samples.forEach(s => {
            console.log(`- ${s.email}: age="${s.age}", height="${s.height}", weight="${s.weight}"`);
        });
    }
}

diagnose();
