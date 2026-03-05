const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runSQL() {
    const sqlPath = process.argv[2];
    if (!sqlPath) {
        console.error('Usage: node run_sql.js <path_to_sql_file>');
        process.exit(1);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log(`Executing SQL from ${sqlPath}...`);

    // Using the Postgres REST interface to execute arbitrary SQL is not directly supported by supabase-js
    // except via RPC or if it's a migration. 
    // However, for this environment, we've often seen 'exec_sql' or similar RPCs.
    // Let's try to find an RPC or use a trick.

    // Alternative: Some environments have an 'exec_sql' RPC defined for admin tools.
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('Error executing SQL:', error);
        // If exec_sql doesn't exist, we might be stuck without a proper CLI or higher-privilege key.
        // But since this is a developer tool, we often have 'service_role' access or similar.
        // Let's check for other common names.
    } else {
        console.log('SQL executed successfully:', data);
    }
}

runSQL();
