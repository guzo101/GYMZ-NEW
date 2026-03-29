const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectSchema() {
    const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'users' });

    if (error) {
        // If RPC doesn't exist, try fetching a single row and checking keys
        console.log('RPC get_table_columns not found, fetching sample row...');
        const { data: sample, error: sampleError } = await supabase.from('users').select('*').limit(1);
        if (sample && sample.length > 0) {
            console.log('Columns found in users table:');
            console.log(Object.keys(sample[0]).sort().join(', '));
        } else {
            console.error('Failed to fetch sample row:', sampleError);
        }
    } else {
        console.log('Columns:', data);
    }
}

inspectSchema();
