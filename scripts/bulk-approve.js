
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Error: Missing environment variables.');
    console.error('Make sure .env.local exists and contains NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function approveAllUsers() {
    console.log('🚀 Starting bulk approval...');

    // 1. Fetch one user to check structure
    const { data: userData, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .limit(1);

    if (userData && userData.length > 0) {
        console.log('User keys:', Object.keys(userData[0]));
    }

    if (fetchError) {
        console.error('Error fetching users:', fetchError);
        return;
    }

    if (!pendingUsers || pendingUsers.length === 0) {
        console.log('✅ No pending users found.');
        return;
    }

    console.log(`Found ${pendingUsers.length} pending users.`);

    // 2. Approve all users
    const { error: updateError } = await supabase
        .from('profiles')
        .update({ is_approved: true })
        .in('id', pendingUsers.map(u => u.id));

    if (updateError) {
        console.error('Error updating users:', updateError);
        return;
    }

    console.log(`✅ Successfully approved ${pendingUsers.length} users:`);
    pendingUsers.forEach(u => console.log(` - ${u.full_name} (${u.id})`));
}

approveAllUsers();
