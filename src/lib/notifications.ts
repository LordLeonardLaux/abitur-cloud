'use server';

// This function runs on the client (or server) and calls our OWN API route
// ensuring the OneSignal Key stays properly secured on the Server.

import { getApiUrl } from '@/lib/platform';
import { supabase } from '@/lib/supabase/client';

export async function sendNotification(
    targeting: { userIds?: string[], segments?: string[], subjectId?: string, courseType?: string, gradeLevel?: string },
    heading: string,
    content: string,
    data?: any
) {
    console.log('[Notification] Requesting API send:', { heading, targeting });

    try {
        // We need the current session for the API route to verify us
        const { data: { session } } = await supabase.auth.getSession();

        const apiUrl = getApiUrl('/api/notifications'); // Smart helper for localhost vs prod

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Pass auth token if needed, or rely on cookie (server vs client)
                // For mobile/external, we MUST pass the token header usually?
                // supabase.auth.getUser() on server reads cookies. 
                // Mobile app might need to pass Bearer token explicitly if cookies aren't shared?
                // Let's pass it to be safe.
                ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
            },
            body: JSON.stringify({
                targeting,
                heading,
                content,
                data
            })
        });

        if (!response.ok) {
            console.error('[Notification] API Route Error:', response.status);
        } else {
            console.log('[Notification] Sent successfully via API.');
        }
    } catch (e) {
        console.error('[Notification] Network Error:', e);
    }
}
