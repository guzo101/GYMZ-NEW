const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkColumns() {
    const requiredColumns = [
        'id', 'email', 'name', 'unique_id', 'gym_id',
        'membership_status', 'membership_type', 'access_mode',
        'avatar_url', 'renewal_due_date', 'weight_lost',
        'height', 'weight', 'age', 'gender', 'goal'
    ];

    console.log('Checking columns in users table...');
    const { data, error } = await supabase.from('users').select('*').limit(1);

    if (error) {
        console.error('Error fetching users:', error);
        return;
    }

    if (data.length === 0) {
        console.log('No users found to inspect. Trying to fetch column names via RPC if available...');
        // Since we can't see the columns if there are no rows (without a specific RPC), 
        // we'll just have to assume the error message about weight_lost is accurate.
        return;
    }

    const existingColumns = Object.keys(data[0]);
    const missing = requiredColumns.filter(col => !existingColumns.includes(col));

    if (missing.length > 0) {
        console.log('MISSING COLUMNS:', missing);
    } else {
        console.log('All required columns exist.');
    }
}

checkColumns();
