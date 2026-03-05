const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve('.env');
const env = fs.readFileSync(envPath, 'utf8');

const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

const tables = [
    'gym_onboarding_status', 'gym_branches', 'gym_contacts', 'gym_verification_documents',
    'gym_hours', 'gym_media_assets', 'admin_audit_logs', 'gym_membership_plans',
    'gym_promotions', 'gym_facilities_equipment', 'gym_trainers', 'gym_classes',
    'gym_class_schedules', 'gym_payment_methods', 'gym_receipt_rules', 'gym_discovery_settings'
];

async function check() {
    const results = [];
    for (const t of tables) {
        const { data, error } = await supabase.from(t).select('*').limit(1);

        if (error && error.code === '42P01') {
            results.push(`[MISSING] ${t}`);
        } else if (error) {
            // If RLS blocks it or something else, it still means the table exists
            results.push(`[OK - EXISTS] ${t} - Table exists but access restricted (${error.message})`);
        } else {
            results.push(`[OK - EXISTS] ${t} - Accessible`);
        }
    }
    console.log(results.join('\n'));
}

check();
