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
        const { targeting, heading, content, data } = body;

        const ONESIGNAL_APP_ID = '78604014-b8b1-4f95-8020-0d00fa250dbc';
        // USE THE KEY HERE SAFELY ON SERVER
        const ONESIGNAL_API_KEY = 'os_v2_app_pbqeaffywfhzlababuapujinxq7pnd3ristey3vbb6ovftknzfmppr6gznmvomkoaanwk2sc2gjo2khpqb3u7oome2gut3k2ygxtu5y';

        // Construct OneSignal Payload
        const payload: any = {
            app_id: ONESIGNAL_APP_ID,
            channel_for_external_user_ids: "push",
            headings: { en: heading, de: heading },
            contents: { en: content, de: content },
            data: data,
            ios_sound: "default",
            priority: 10
        };

        // Targeting Logic
        if (targeting?.userIds?.length > 0) {
            // Target specific users
            payload.include_external_user_ids = targeting.userIds;
        }
        else if (targeting?.segments?.length > 0) {
            // Target segments (e.g. "Admins", "All")
            payload.included_segments = targeting.segments;
        }
        else if (targeting?.subjectId) {
            // Target by Tags (Subject & Level)
            const filters = [];

            // Filter 1: Subject
            // If courseType is set (e.g. "LK"), target that value.
            // If not set (or "m"/"a"), target existence (any student with this subject) - OR specific values?
            // NotificationProvider tags: "LK", "GK" or "true".
            // If CreateTask sends "LK", we want tag value "LK".
            if (targeting.courseType && ['LK', 'GK'].includes(targeting.courseType)) {
                filters.push({ field: "tag", key: `subject_${targeting.subjectId}`, relation: "=", value: targeting.courseType });
            } else {
                // Target anyone having this subject tag (exists)
                filters.push({ field: "tag", key: `subject_${targeting.subjectId}`, relation: "exists" });
            }

            // Filter 2: Grade Level (AND)
            if (targeting.gradeLevel) {
                filters.push({ field: "tag", key: "grade", relation: "=", value: targeting.gradeLevel });
            }

            payload.filters = filters;
        }
        else {
            // Default Fallback: Broadcast to All (Safety)
            // Or maybe restrict? For now, 'All' ensures delivery if logic fails.
            payload.included_segments = ["All"];
        }

        const response = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${ONESIGNAL_API_KEY}`
            },
            body: JSON.stringify(payload)
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
