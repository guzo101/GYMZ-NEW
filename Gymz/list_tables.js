
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function listTables() {
    const { data, error } = await supabase.from('pg_catalog.pg_tables').select('tablename').eq('schemaname', 'public');
    if (error) {
        console.error('Error fetching tables:', error);
        // Fallback: try common names
        const commonNames = ['user_snapshots', 'progress_photos', 'snapshots', 'user_progress_photos'];
        for (const name of commonNames) {
            const { error: testError } = await supabase.from(name).select('*').limit(1);
            if (!testError) {
                console.log(`Found table: ${name}`);
            }
        }
    } else {
        console.log('Tables:', data.map(t => t.tablename));
    }
}

listTables();
