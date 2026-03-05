const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function setAdmin() {
    const email = 'gymz@msafiristudios.com';

    // NOTE: If RLS is strictly enforced, this anon key might fail to update. Let's see.
    const { data, error } = await supabase
        .from('users')
        .update({ role: 'platform_admin' })
        .eq('email', email)
        .select();

    if (error) {
        console.error(`Failed to update user: ${error.message}`);
    } else {
        if (data && data.length > 0) {
            console.log(`Successfully updated ${email} to platform_admin!`);
        } else {
            console.log(`Update command succeeded, but no rows returned. This could mean the user doesn't exist, or Row Level Security blocked the update.`);
        }
    }
}

setAdmin();
