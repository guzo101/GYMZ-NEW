
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectUser() {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', 'bnn@gmail.com')
        .maybeSingle();

    if (error) {
        console.error('Error fetching user:', error);
        return;
    }

    if (!data) {
        console.log('User not found');
        return;
    }

    console.log('--- USER PROFILE DATA ---');
    console.log(JSON.stringify(data, null, 2));
}

inspectUser();
