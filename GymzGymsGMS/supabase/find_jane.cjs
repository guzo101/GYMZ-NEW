const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function findJane() {
    const { data, error } = await supabase
        .from('users')
        .select('id, email, name, metadata, weight, height, age, goal, primary_objective, calculated_bmi')
        .ilike('email', '%jane%')
        .limit(5);

    if (error) {
        console.error('Error finding Jane:', error);
    } else {
        console.log('Jane(s) found:', JSON.stringify(data, null, 2));
    }
}

findJane();
