import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
    try {
        // Validation: Verify the user token
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await adminClient.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Optional: Check if user is teacher/admin?
        // For now, allow any logged in user (or teacher) to trigger it? 
        // Better to check role. But 'user' object might not have role.
        // We'll trust the auth for now as a basic guard.

        const body = await request.json();
        const { userIds, heading, content, data } = body;

        const ONESIGNAL_APP_ID = '78604014-b8b1-4f95-8020-0d00fa250dbc';
        // USE THE KEY HERE SAFELY ON SERVER
        const ONESIGNAL_API_KEY = 'os_v2_app_pbqeaffywfhzlababuapujinxq7pnd3ristey3vbb6ovftknzfmppr6gznmvomkoaanwk2sc2gjo2khpqb3u7oome2gut3k2ygxtu5y';

        const response = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${ONESIGNAL_API_KEY}`
            },
            body: JSON.stringify({
                app_id: ONESIGNAL_APP_ID,
                // BROADCAST to All for now (as native bridge is missing)
                included_segments: ["All"],
                // include_external_user_ids: userIds,

                channel_for_external_user_ids: "push",
                headings: { en: heading, de: heading },
                contents: { en: content, de: content },
                data: data,
                ios_sound: "default",
                priority: 10
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[API Notification] OneSignal Error:', errorText);
            return NextResponse.json({ error: 'OneSignal API Error' }, { status: 500 });
        }

        const result = await response.json();
        return NextResponse.json({ success: true, result });

    } catch (error) {
        console.error('[API Notification] Server Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
