
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkData() {
    console.log('🔍 Emergency Data Check...');

    // Check Profiles
    const { count: profileCount, error: profileError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

    if (profileError) console.error('❌ Profiles Error:', profileError);
    else console.log(`✅ Profiles Count: ${profileCount}`);

    // Fetch a sample
    const { data: users, error: userError } = await supabase
        .from('profiles')
        .select('*')
        .limit(5);

    if (userError) console.error('❌ User Fetch Error:', userError);
    else {
        console.log('Sample Users:', JSON.stringify(users, null, 2));
    }
    // Check Teacher Materials
    const { count: tmCount, error: tmError } = await supabase
        .from('teacher_materials')
        .select('*', { count: 'exact', head: true });

    if (tmError) console.error('❌ Teacher Materials Error:', tmError);
    else console.log(`✅ Teacher Materials Count: ${tmCount}`);

    // Check Class Materials
    const { count: cmCount, error: cmError } = await supabase
        .from('class_materials') // Verify this table name from types.ts if needed
        .select('*', { count: 'exact', head: true });

    if (cmError) console.error('❌ Class Materials Error:', cmError);
    else console.log(`✅ Class Materials Count: ${cmCount}`);
}

checkData();
