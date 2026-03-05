import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkTriggers() {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'admin@Gymz.com',
        password: 'Admin@123'
    });

    // Query information_schema.triggers using rpc or standard query if possible
    // Since we might not have direct info_schema access from the client, let's try an RPC 
    // or just check the handle_new_user definition

    const { data, error } = await supabase.rpc('get_function_def', { func_name: 'handle_new_user' });
    console.log("handle_new_user def:", data || error);

    const { data: d2, error: e2 } = await supabase.rpc('get_function_def', { func_name: 'notify_admin_on_new_payment' });
    console.log("notify_admin_on_new_payment def:", d2 || e2);
}

checkTriggers();
