
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function probeTables() {
    const prospects = [
        'user_snapshots',
        'snapshots',
        'progress_snapshots',
        'progress_photos',
        'user_progress_photos',
        'body_snapshots',
        'transformation_photos',
        'body_metrics', // Exists
        'daily_nutrition_logs' // Exists
    ];

    for (const name of prospects) {
        const { error } = await supabase.from(name).select('*').limit(1);
        if (!error) {
            console.log(`Found table: ${name}`);
        } else {
            if (error.code !== 'PGRST204' && error.code !== 'PGRST205') {
                console.log(`Table ${name} exists but error: ${error.message} (${error.code})`);
            } else {
                // console.log(`Table ${name} NOT found`);
            }
        }
    }
}

probeTables();
