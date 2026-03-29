const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function findGym() {
    console.log('--- FINDING SWEAT FACTORY ---');
    const { data, error } = await supabase
        .from('gyms')
        .select('id, name, slug')
        .ilike('name', '%Sweat Factory%');

    if (error) {
        console.error('Gym Fetch Error:', error);
    } else {
        console.log('Gyms found:');
        console.table(data);
    }
}

findGym();
