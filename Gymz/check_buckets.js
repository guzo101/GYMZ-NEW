
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24pLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function checkBuckets() {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) {
        console.error('Error fetching buckets:', error);
        // Fallback: try to list files in the suspected bucket
        const { data: files, error: fileError } = await supabase.storage.from('user-snapshots').list('', { limit: 1 });
        if (fileError) {
            console.error('Error listing files in user-snapshots:', fileError);
        } else {
            console.log('user-snapshots bucket exists and contains files.');
        }
    } else {
        console.log('Buckets:', data.map(b => b.name));
    }
}

checkBuckets();
