import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkTrigger() {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'admin@Gymz.com',
        password: 'Admin@123'
    });

    if (authError) {
        console.error("Auth Error:", authError);
        return;
    }

    // Create a minimal payment to see what happens
    const gymId = '85e921d6-444f-4632-ab16-5d677610bd8b';
    const { data, error } = await supabase.from('payments').insert([{
        amount: 400,
        payment_method: 'cash',
        status: 'pending',
        user_id: authData.user.id,
        gym_id: gymId
    }]).select();

    console.log("Insert response:", { data, error });

    setTimeout(async () => {
        const { data: notifs } = await supabase.from('notifications').select('*').eq('gym_id', gymId).order('created_at', { ascending: false }).limit(3);
        console.log("Recent notifications for gym:", notifs);
    }, 3000);
}

checkTrigger();
