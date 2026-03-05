import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testPayment() {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'admin@Gymz.com',
        password: 'Admin@123'
    });

    if (authError) {
        console.error("Auth Error:", authError);
        return;
    }

    const targetGymId = '85e921d6-444f-4632-ab16-5d677610bd8b'; // Assuming Sky Gym or similar

    // 1. Try an insert directly to payments to see if RLS blocks it or if trigger fires
    const { data: payData, error: payError } = await supabase
        .from('payments')
        .insert([
            {
                amount: 350,
                payment_method: 'cash',
                status: 'pending',
                user_id: authData.user.id, // self payment test
                gym_id: targetGymId
            }
        ])
        .select()
        .single();

    console.log("Payment Insert Result:", payData || payError);

    if (payData) {
        // Check if notification was created
        setTimeout(async () => {
            const { data: notifQuery, error: notifError } = await supabase
                .from('notifications')
                .select('*')
                .eq('payment_id', payData.id);

            console.log("Generated Notifications:", notifQuery || notifError);
        }, 2000);
    }
}

testPayment();
