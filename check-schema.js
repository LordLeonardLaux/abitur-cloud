
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getSchema() {
    console.log('Fetching profiles schema...');
    // We can't query information_schema easily with js client (needs RPC or SQL editor usually)
    // But we can just limit 1 and see keys
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching profiles:', error);
    } else {
        if (data && data.length > 0) {
            console.log('Columns found:', Object.keys(data[0]));
        } else {
            console.log('No data found, but table exists.');
        }
    }
}

getSchema();
