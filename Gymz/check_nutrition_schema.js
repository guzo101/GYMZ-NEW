const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkNutritionSchema() {
    console.log('--- CHECKING daily_nutrition_logs SCHEMA ---');
    const { data: sample, error } = await supabase.from('daily_nutrition_logs').select('*').limit(1);
    if (error) {
        console.error('Error fetching logs:', error);
    } else if (sample && sample.length > 0) {
        console.log('Columns found:', Object.keys(sample[0]).sort().join(', '));
    } else {
        console.log('Table is empty. Trying to fetch one column to see if it exists...');
        const { error: idErr } = await supabase.from('daily_nutrition_logs').select('id').limit(1);
        console.log('Select id error:', idErr ? idErr.message : 'SUCCESS');
        const { error: logIdErr } = await supabase.from('daily_nutrition_logs').select('log_id').limit(1);
        console.log('Select log_id error:', logIdErr ? logIdErr.message : 'SUCCESS');
    }
}

checkNutritionSchema();
