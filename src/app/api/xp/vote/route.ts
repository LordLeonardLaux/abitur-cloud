import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { voterId, materialId, uploaderId, materialType } = body;

        if (!voterId || !materialId || !uploaderId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (voterId === uploaderId) {
            return NextResponse.json({ success: false, alreadyVoted: false, message: 'Cannot vote for own material' });
        }

        // Check if vote exists
        const { data: existingVotes, error: checkError } = await adminClient
            .from('useful_votes')
            .select('id')
            .eq('voter_id', voterId)
            .eq('material_id', materialId);

        if (checkError) throw checkError;

        if (existingVotes && existingVotes.length > 0) {
            return NextResponse.json({ success: false, alreadyVoted: true });
        }

        // Insert vote
        const { error: insertError } = await adminClient
            .from('useful_votes')
            .insert({
                voter_id: voterId,
                material_id: materialId,
                material_type: materialType || 'class_material',
                uploader_id: uploaderId,
            });

        if (insertError) throw insertError;

        // Fetch current XP of uploader
        const { data: profiles, error: profileError } = await adminClient
            .from('profiles')
            .select('xp, rank_visible')
            .eq('id', uploaderId)
            .single();

        if (profileError) throw profileError;

        if (profiles.rank_visible) {
            const currentXp = profiles.xp || 0;
            const newXp = currentXp + 3; // XP_VOTE

            // Update XP
            const { error: updateError } = await adminClient
                .from('profiles')
                .update({ xp: newXp })
                .eq('id', uploaderId);

            if (updateError) throw updateError;
        }

        return NextResponse.json({ success: true, alreadyVoted: false });
    } catch (error: any) {
        console.error('[API] Error handling vote:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
