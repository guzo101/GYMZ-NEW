const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkGymExactly() {
    console.log('--- FETCHING EXACT GYM RECORD ---');
    const { data, error } = await supabase
        .from('gyms')
        .select('id, name, slug')
        .eq('slug', 'sweat-factory');

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Results:');
        console.log(JSON.stringify(data, null, 2));
        if (data && data.length > 0) {
            console.log(`Length of ID string: ${data[0].id.length}`);
        }
    }
}

checkGymExactly();
