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

async function listBuckets() {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) {
        console.error('Error fetching buckets:', error);
    } else {
        console.log('Available buckets:', data.map(b => ({ name: b.name, public: b.public })));
    }
}

listBuckets();
