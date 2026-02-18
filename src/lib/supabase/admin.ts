import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseServiceRoleKey) {
    console.warn('[AdminClient] SUPABASE_SERVICE_ROLE_KEY is missing. Admin actions will fail.');
}

// Admin client for server-side actions (approving users, etc.)
// The service role key is server-side only (no NEXT_PUBLIC_ prefix)
export const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
