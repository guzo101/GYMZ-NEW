
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function testUpload() {
    const filename = `test-${Date.now()}.txt`;
    const content = "Hello World";

    console.log(`Attempting to upload ${filename} to 'user-snapshots'...`);

    const { data, error } = await supabase.storage
        .from('user-snapshots')
        .upload(filename, content, {
            contentType: 'text/plain',
            upsert: true
        });

    if (error) {
        console.error('Upload failed:', error);
    } else {
        console.log('Upload successful!', data);

        // Try to get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('user-snapshots')
            .getPublicUrl(filename);
        console.log('Public URL:', publicUrl);
    }
}

testUpload();
