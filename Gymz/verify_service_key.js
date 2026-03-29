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

async function checkAuth() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
        console.error('Service Role Auth Check Failed:', error);
    } else {
        console.log('Service Role Auth Check Succeeded (user info not expected but call worked)');
    }

    // Try to list schemas
    const { data: schemas, error: schemaError } = await supabase.from('users').select('id').limit(1);
    if (schemaError) {
        console.error('Database query with Service Role Failed:', schemaError);
    } else {
        console.log('Database query with Service Role Succeeded');
    }
}

checkAuth();
