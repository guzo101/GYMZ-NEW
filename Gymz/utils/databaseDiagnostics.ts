import { supabase } from '../services/supabase';

/**
 * DIAGNOSTIC TOOL: Check Supabase Connection and Database Access
 * Run this from the app to diagnose why messages aren't persisting
 */

export async function runDatabaseDiagnostics(userId: string) {
    console.log("🔍 === DATABASE DIAGNOSTICS START ===");

    const results = {
        connection: false,
        tableExists: false,
        canRead: false,
        canWrite: false,
        hasData: false,
        recordCount: 0,
        errors: [] as string[]
    };

    // TEST 1: Check Supabase connection
    try {
        console.log("\n📡 TEST 1: Checking Supabase connection...");
        const { data, error } = await (supabase as any)
            .from('users')
            .select('id')
            .eq('id', userId)
            .maybeSingle();

        if (error) {
            results.errors.push(`Connection error: ${error.message}`);
            console.error("❌ Connection failed:", error);
        } else {
            results.connection = true;
            console.log("✅ Supabase connection OK");
            console.log("   User found:", data ? "Yes" : "No");
        }
    } catch (err: any) {
        results.errors.push(`Connection exception: ${err.message}`);
        console.error("❌ Connection exception:", err);
    }

    // TEST 2: Check if 'conversations' table exists
    try {
        console.log("\n📋 TEST 2: Checking 'conversations' table...");
        const { data, error } = await (supabase as any)
            .from('conversations')
            .select('id')
            .limit(1);

        if (error) {
            if (error.code === '42P01') {
                results.errors.push("Table 'conversations' does not exist!");
                console.error("❌ Table does not exist");
            } else {
                results.errors.push(`Table check error: ${error.message}`);
                console.error("❌ Table check failed:", error);
            }
        } else {
            results.tableExists = true;
            console.log("✅ Table 'conversations' exists");
        }
    } catch (err: any) {
        results.errors.push(`Table check exception: ${err.message}`);
        console.error("❌ Table check exception:", err);
    }

    // TEST 3: Check READ permissions
    try {
        console.log("\n📖 TEST 3: Testing READ permissions...");
        const { data, error } = await (supabase as any)
            .from('conversations')
            .select('*')
            .eq('user_id', userId)
            .limit(10);

        if (error) {
            results.errors.push(`Read permission error: ${error.message}`);
            console.error("❌ Cannot read from table:", error);
        } else {
            results.canRead = true;
            results.recordCount = data?.length || 0;
            results.hasData = results.recordCount > 0;
            console.log("✅ Can read from table");
            console.log(`   Found ${results.recordCount} records for user ${userId}`);
            if (data && data.length > 0) {
                console.log("   Sample record:", data[0]);
            }
        }
    } catch (err: any) {
        results.errors.push(`Read exception: ${err.message}`);
        console.error("❌ Read exception:", err);
    }

    // TEST 4: Check WRITE permissions
    try {
        console.log("\n✍️  TEST 4: Testing WRITE permissions...");
        const testMessage = {
            user_id: userId,
            thread_id: 'diagnostic-test',
            chat_id: 'diagnostic-test',
            sender: 'user',
            message: 'DIAGNOSTIC TEST - DELETE ME',
            timestamp: new Date().toISOString()
        };

        const { data, error } = await (supabase as any)
            .from('conversations')
            .insert(testMessage)
            .select();

        if (error) {
            results.errors.push(`Write permission error: ${error.message}`);
            console.error("❌ Cannot write to table:", error);
            console.error("   Error details:", {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint
            });
        } else {
            results.canWrite = true;
            console.log("✅ Can write to table");
            console.log("   Test record created:", data);

            // Clean up test record
            if (data && data[0]?.id) {
                await (supabase as any)
                    .from('conversations')
                    .delete()
                    .eq('id', data[0].id);
                console.log("   Test record deleted");
            }
        }
    } catch (err: any) {
        results.errors.push(`Write exception: ${err.message}`);
        console.error("❌ Write exception:", err);
    }

    // TEST 5: Check table schema
    try {
        console.log("\n🏗️  TEST 5: Checking table schema...");
        const { data, error } = await (supabase as any)
            .from('conversations')
            .select('*')
            .limit(1);

        if (data && data.length > 0) {
            const columns = Object.keys(data[0]);
            console.log("✅ Table columns:", columns);

            const requiredColumns = ['id', 'user_id', 'thread_id', 'chat_id', 'sender', 'message', 'timestamp'];
            const missingColumns = requiredColumns.filter(col => !columns.includes(col));

            if (missingColumns.length > 0) {
                results.errors.push(`Missing columns: ${missingColumns.join(', ')}`);
                console.error("❌ Missing required columns:", missingColumns);
            } else {
                console.log("✅ All required columns present");
            }
        }
    } catch (err: any) {
        console.warn("⚠️  Could not check schema:", err);
    }

    // SUMMARY
    console.log("\n📊 === DIAGNOSTIC SUMMARY ===");
    console.log("Connection:", results.connection ? "✅" : "❌");
    console.log("Table exists:", results.tableExists ? "✅" : "❌");
    console.log("Can read:", results.canRead ? "✅" : "❌");
    console.log("Can write:", results.canWrite ? "✅" : "❌");
    console.log("Has data:", results.hasData ? `✅ (${results.recordCount} records)` : "❌ (0 records)");

    if (results.errors.length > 0) {
        console.log("\n❌ ERRORS FOUND:");
        results.errors.forEach((err, i) => {
            console.log(`   ${i + 1}. ${err}`);
        });
    }

    console.log("\n🔍 === DATABASE DIAGNOSTICS END ===\n");

    return results;
}

// Export for use in screens
export default runDatabaseDiagnostics;
