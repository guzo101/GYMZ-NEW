import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkPolicies() {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'admin@Gymz.com',
        password: 'Admin@123'
    });

    const { data, error } = await supabase.rpc('get_table_policies', { p_table_name: 'users' });
    if (error) {
        console.error('Cannot run rpc, falling back to direct query');
        const { data: qData, error: qError } = await supabase.from('users').select('id, gym_id, role').limit(5);
        console.log(qData);
    } else {
        console.log(data);
    }
}

checkPolicies();
