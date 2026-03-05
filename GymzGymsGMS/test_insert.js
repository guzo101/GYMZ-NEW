const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable() {
    console.log("Checking events table...");
    try {
        const { error } = await supabase.from('events').insert([{
            title: "Test Event",
            event_date: new Date().toISOString()
        }]);
        console.log("Insert result (should fail but give details):", JSON.stringify(error, null, 2));
    } catch (e) {
        console.log("Exception:", e);
    }
}

checkTable();
