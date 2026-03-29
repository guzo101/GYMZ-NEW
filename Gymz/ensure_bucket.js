/**
 * Dev script. Requires SUPABASE_SERVICE_ROLE_KEY in env. Excluded from EAS via .easignore.
 */
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_SERVICE_KEY) {
  console.error("Error: SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function createBucket() {
    console.log('Ensuring bucket "user-snapshots" exists...');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
        console.error('Error listing buckets:', listError);
        return;
    }

    const exists = buckets.find(b => b.name === 'user-snapshots');
    if (exists) {
        console.log('Bucket "user-snapshots" already exists.');
    } else {
        console.log('Creating bucket "user-snapshots"...');
        const { data, error } = await supabase.storage.createBucket('user-snapshots', {
            public: true,
            fileSizeLimit: 5242880,
            allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
        });

        if (error) {
            console.error('Error creating bucket:', error);
        } else {
            console.log('Bucket created successfully!');
        }
    }
}

createBucket();
