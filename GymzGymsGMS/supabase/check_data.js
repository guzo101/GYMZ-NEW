import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkData() {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'admin@Gymz.com',
        password: 'Admin@123'
    });

    const { data: payments, error: pError } = await supabase
        .from('payments')
        .select('id, user_id, amount, gym_id, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    console.log("Recent Payments:", payments || pError);

    const { data: users, error: uError } = await supabase
        .from('users')
        .select('id, email, name, gym_id, role, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    console.log("Recent Users:", users || uError);

    const { data: notifs, error: nError } = await supabase
        .from('notifications')
        .select('id, user_id, type, gym_id, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    console.log("Recent Notifications:", notifs || nError);
}

checkData();
