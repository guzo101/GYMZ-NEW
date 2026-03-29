
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function testExecuteSql() {
    try {
        console.log('Testing execute_sql RPC...');
        const result = await supabase.rpc('execute_sql', {
            query: 'SELECT 1;'
        });

        console.log('QueryResult:', JSON.stringify(result));

        if (result.error) {
            console.error('RPC Error (query):', result.error.message);

            const result2 = await supabase.rpc('execute_sql', {
                sql: 'SELECT 1;'
            });
            console.log('SqlResult:', JSON.stringify(result2));
            if (result2.error) {
                console.error('RPC Error (sql):', result2.error.message);
            } else {
                console.log('Success with "sql" parameter!');
            }
        } else {
            console.log('Success with "query" parameter!');
        }
    } catch (err) {
        console.error('Fatal Error:', err.message);
    }
}

testExecuteSql();
