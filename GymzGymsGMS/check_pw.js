import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkUser() {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'gymz@msafiristudios.com',
        password: 'Password@123'
    });

    if (authError) {
        console.error('Login Failed with Password@123:', authError.message);
    } else {
        console.log("Password is Password@123!");
        return;
    }

    const { data: authData2, error: authError2 } = await supabase.auth.signInWithPassword({
        email: 'gymz@msafiristudios.com',
        password: 'Admin@123'
    });

    if (authError2) {
        console.error('Login Failed with Admin@123:', authError2.message);
    } else {
        console.log("Password is Admin@123!");
        return;
    }
}

checkUser();
