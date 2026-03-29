
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function testUpload() {
    const filename = `test-${Date.now()}.jpg`;
    // Dummy JPEG header or just some data
    const content = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);

    console.log(`Attempting to upload ${filename} to 'user-snapshots'...`);

    const { data, error } = await supabase.storage
        .from('user-snapshots')
        .upload(filename, content, {
            contentType: 'image/jpeg',
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
