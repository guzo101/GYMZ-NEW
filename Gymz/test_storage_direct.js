/**
 * Dev script. Requires SUPABASE_SERVICE_ROLE_KEY in env. Excluded from EAS via .easignore.
 */
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_SERVICE_KEY) {
  console.error("Error: SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

async function checkStorageAPI() {
    console.log('Checking Storage API directly...');
    try {
        const response = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            }
        });

        console.log('Status:', response.status);
        const data = await response.json();
        console.log('Data:', data);
    } catch (error) {
        console.error('Fetch Error:', error);
    }
}

checkStorageAPI();
