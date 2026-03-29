const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function diagnoseJane() {
    const email = 'jane@msafiristudios.com';
    console.log(`--- INVESTIGATING ${email} ---`);

    // 1. Fetch User Profile
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

    if (userError) {
        console.error('User Fetch Error:', userError);
    } else {
        console.log('User Profile found:');
        console.log(JSON.stringify(user, null, 2));
    }

    // 2. Fetch Payments
    if (user) {
        const { data: payments, error: paymentError } = await supabase
            .from('payments')
            .select('*')
            .eq('user_id', user.id);

        if (paymentError) {
            console.error('Payment Fetch Error:', paymentError);
        } else {
            console.log(`\nPayments found (${payments.length}):`);
            console.table(payments.map(p => ({
                id: p.id,
                amount: p.amount,
                status: p.status,
                created_at: p.created_at
            })));
        }

        // 3. Fetch Subscriptions
        const { data: subs, error: subError } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id);

        if (subError) {
            console.error('Subscription Fetch Error:', subError);
        } else {
            console.log(`\nSubscriptions found (${subs.length}):`);
            console.table(subs);
        }
    }
}

diagnoseJane();
