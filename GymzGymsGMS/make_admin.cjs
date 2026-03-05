const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('', '');

async function run() {
  const { data, error } = await supabase
    .from('users')
    .update({ role: 'platform_admin' })
    .eq('email', 'gymz@msafiristudios.com')
    .select();
    
  if (error) console.error('Error:', error.message);
  else console.log('Success! Updated user to platform_admin:', data);
}
run();
