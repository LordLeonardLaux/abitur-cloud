
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkStorage() {
    console.log('📦 Checking Storage...');

    // List Buckets
    const { data: buckets, error: bucketError } = await supabase
        .storage
        .listBuckets();

    if (bucketError) {
        console.error('❌ Bucket List Error:', bucketError);
        return;
    }

    console.log(`✅ Found ${buckets.length} buckets:`);
    buckets.forEach(b => console.log(` - ${b.name}`));

    // Check specific buckets
    for (const b of buckets) {
        if (['materials', 'exams', 'pdfs'].includes(b.name)) {
            console.log(`\n📄 Listing files in '${b.name}'...`);
            const { data: files, error: fileError } = await supabase
                .storage
                .from(b.name)
                .list('', { limit: 5 });

            if (fileError) console.error(`❌ List Error for ${b.name}:`, fileError);
            else {
                console.log(`Found ${files.length} files in ${b.name}:`);
                files.forEach(f => console.log(` - ${f.name} (${f.metadata ? f.metadata.size : '?'} bytes)`));
            }
        }
    }

    // List Tables
    console.log('\n📊 Listing Database Tables...');
    // Note: accessing information_schema might need higher privs or direct sql, 
    // but we can try select from specific known tables or generic RPC if available.
    // Instead, let's try to infer from a known query or just report the buckets for now.
    // Service role should allow us to use the inspector if we had the management API, but we use the client.
    // We will assume the previous 'null' for teacher_materials meant "error" or "no access".
}

checkStorage();
