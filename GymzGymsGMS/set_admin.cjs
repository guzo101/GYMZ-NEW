const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve('.env');
const env = fs.readFileSync(envPath, 'utf8');

const urlMatch = env.match(/VITE_SUPABASE_URL=([^\r\n]+)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=([^\r\n]+)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function setAdmin() {
    const email = 'gymz@msafiristudios.com';

    // Update the user's role to platform_admin
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
            console.log(`User ${email} not found in the public.users table.`);
        }
    }
}

setAdmin();
