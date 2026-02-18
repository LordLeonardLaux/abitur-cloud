import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId } = body;

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        console.log(`[API] Approving user: ${userId}`);

        // Update profile to is_approved = true
        const { error: updateError } = await adminClient
            .from('profiles')
            .update({ is_approved: true })
            .eq('id', userId);

        if (updateError) {
            console.error(`[API] Update error: ${updateError.message}`);
            return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[API] Error handling approval:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
