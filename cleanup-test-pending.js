const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanup() {
    console.log('Cleaning up user testpending...');

    // 1. Get User ID
    const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', 'testpending')
        .single();

    if (userError || !user) {
        console.log('User not found or already deleted.');
        return;
    }

    // 2. Delete from Auth (cascades to public tables usually, but we do explicit if needed)
    console.log('Deleting user:', user.id);
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);

    if (deleteError) {
        console.error('Delete failed:', deleteError);
    } else {
        console.log('User deleted successfully!');
    }
}

cleanup();
