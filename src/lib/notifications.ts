export async function sendNotification(userIds: string[], heading: string, content: string, data?: any) {
    // Placeholder for OneSignal API call
    // In a real implementation, this would call the OneSignal REST API
    // or a Supabase Edge Function that calls OneSignal.

    console.log('[Notification] Mock Send:', {
        userIds,
        heading,
        content,
        data
    });

    const ONESIGNAL_APP_ID = '78604014-b8b1-4f95-8020-0d00fa250dbc';
    // const ONESIGNAL_API_KEY = process.env.ONESIGNAL_REST_API_KEY; 

    // Ideally: Call /api/notifications/send
    try {
        /*
        await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${ONESIGNAL_API_KEY}` 
            },
            body: JSON.stringify({
                app_id: ONESIGNAL_APP_ID,
                include_external_user_ids: userIds,
                headings: { en: heading },
                contents: { en: content },
                data: data
            })
        });
        */
    } catch (e) {
        console.error('[Notification] Error sending:', e);
    }
}
