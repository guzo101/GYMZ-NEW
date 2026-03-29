const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkMetricsSchema() {
    console.log('--- CHECKING user_behavior_metrics SCHEMA ---');
    const { data: sample, error } = await supabase.from('user_behavior_metrics').select('*').limit(1);
    if (error) {
        console.error('Error fetching metrics:', error);
    } else if (sample && sample.length > 0) {
        console.log('Columns found:', Object.keys(sample[0]).sort().join(', '));
    } else {
        // Try to insert a dummy row or just use an empty select to get keys if possible
        // Actually, if it's empty, we might need another way.
        const { data: cols, error: colErr } = await supabase.rpc('inspect_table_cols', { t_name: 'user_behavior_metrics' });
        if (colErr) console.log('Table exists but is empty and RPC inspect_table_cols is missing.');
        else console.log('Columns from RPC:', cols);
    }
}

checkMetricsSchema();
