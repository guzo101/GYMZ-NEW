const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://bivgvttxaymcdnuvyugv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmd2dHR4YXltY2RudXZ5dWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzE1NTEsImV4cCI6MjA3OTMwNzU1MX0.ovsT42a8h6JYvlvMTB_fuTt1KWt_E-7o6aefrNTxbVE";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkTables() {
    const tables = [
        'users',
        'daily_nutrition_logs',
        'xp_transactions',
        'leaderboard_data',
        'workout_sessions',
        'user_fitness_goals',
        'room_members',
        'user_streaks',
        'weekly_progress_summary',
        'user_calendar_selections',
        'gym_class_schedules',
        'gym_classes'
    ];

    console.log('--- CHECKING TABLES ---');
    for (const table of tables) {
        const { error } = await supabase.from(table).select('*').limit(0);
        if (error) {
            console.log(`❌ Table ${table}: MISSING or ERROR (${error.message})`);
        } else {
            console.log(`✅ Table ${table}: EXISTS`);
        }
    }
}

checkTables();
