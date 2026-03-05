-- ============================================
-- CREATE ADMIN AUTH USER
-- ============================================
-- This script ensures admin@Gymz.com exists in auth.users
-- Run this in the Supabase SQL Editor

-- IMPORTANT: This creates the AUTH user. The public.users record will be 
-- automatically created by the trigger in 20260118_fix_admin_auth_final.sql

-- Method 1: Using SQL (if service_role key is available)
-- Note: Replace 'Admin@123' with the hashed password or use Supabase Dashboard

-- Unfortunately, we can't directly insert into auth.users via SQL in production
-- You MUST use one of the following methods instead:

/*
╔══════════════════════════════════════════════════════════════╗
║          ADMIN USER CREATION - STEP BY STEP GUIDE            ║
╚══════════════════════════════════════════════════════════════╝

METHOD 1: Via Supabase Dashboard (RECOMMENDED)
---------------------------------------------
1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add User"
3. Enter:
   - Email: admin@Gymz.com
   - Password: Admin@123
   - Auto Confirm: ✓ (check this box)
   - Send Email Confirmation: ✗ (uncheck this)
4. Click "Create User"
5. The trigger will automatically create the public.users record


METHOD 2: Via Supabase API (For DevOps/Scripts)
-----------------------------------------------
Run this Node.js script:

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://bivgvttxaymcdnuvyugv.supabase.co',
  'YOUR_SERVICE_ROLE_KEY_HERE' // Get this from Supabase Dashboard → Settings → API
);

async function createAdminUser() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'admin@Gymz.com',
    password: 'Admin@123',
    email_confirm: true, // Auto-confirm email
    user_metadata: {
      name: 'System Administrator',
      role: 'admin'
    }
  });

  if (error) {
    console.error('Error creating admin:', error);
  } else {
    console.log('✅ Admin user created:', data.user.id);
  }
}

createAdminUser();
```


METHOD 3: Check if Admin Already Exists
---------------------------------------
Run this query to see if admin@Gymz.com exists:
*/

SELECT 
  au.id,
  au.email,
  au.created_at,
  pu.role,
  pu.name,
  pu.status
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE au.email = 'admin@Gymz.com';

/*
If the query returns:
- Nothing: Admin doesn't exist → Use METHOD 1 or 2 above
- Row with role='admin': ✅ Admin is set up correctly
- Row with role='member': Run the UPDATE below to fix it
*/

-- FIX: If admin exists but has wrong role
UPDATE public.users 
SET role = 'admin', status = 'active'
WHERE email = 'admin@Gymz.com';

-- Verify it worked
SELECT id, email, role, status FROM public.users WHERE email = 'admin@Gymz.com';
