const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function approveUser() {
    console.log('Finding user testpending...');
    const { data: users, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', 'testpending')
        .single();

    if (userError || !users) {
        console.error('User not found:', userError);
        return;
    }

    console.log('Approving user:', users.id);
    const { error: updateError } = await supabase
        .from('profiles')
        .update({ is_approved: true })
        .eq('id', users.id);

    if (updateError) {
        console.error('Update failed:', updateError);
    } else {
        console.log('User approved successfully!');
    }
}

approveUser();
