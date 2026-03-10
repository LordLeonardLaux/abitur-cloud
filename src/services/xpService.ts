/**
 * XP Service
 * ==========
 * Handles XP operations: adding XP, fetching XP, and vote management.
 * Uses the Supabase REST API via supabaseFetch.
 */

import { supabaseFetch } from '@/repositories/baseRepository';

const XP_UPLOAD = 5;
const XP_VOTE = 3;

/**
 * Add XP to a user's profile.
 * Fetches current XP, adds the amount, and updates.
 */
export async function addXP(userId: string, amount: number): Promise<number> {
    // Fetch current XP
    const profiles = await supabaseFetch<{ xp: number; rank_visible: boolean }[]>(
        `profiles?id=eq.${userId}&select=xp,rank_visible`
    );

    if (!profiles || profiles.length === 0) return 0;

    // If rank is not visible, don't add XP
    if (!profiles[0].rank_visible) return profiles[0].xp || 0;

    const currentXp = profiles[0].xp || 0;
    const newXp = currentXp + amount;

    // Update XP
    await supabaseFetch(
        `profiles?id=eq.${userId}`,
        {
            method: 'PATCH',
            preferReturn: 'minimal',
            body: { xp: newXp },
        }
    );

    return newXp;
}

/**
 * Award XP for uploading a material.
 */
export async function awardUploadXP(userId: string): Promise<number> {
    return addXP(userId, XP_UPLOAD);
}

/**
 * Vote a material as "useful" and award XP to the uploader.
 * Returns { success, alreadyVoted }
 */
export async function voteUseful(
    voterId: string,
    materialId: string,
    uploaderId: string,
    materialType: string = 'class_material'
): Promise<{ success: boolean; alreadyVoted: boolean }> {
    try {
        const response = await fetch('/api/xp/vote', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                voterId,
                materialId,
                uploaderId,
                materialType,
            }),
        });

        if (!response.ok) {
            console.error('[XP Service] Vote API error:', await response.text());
            return { success: false, alreadyVoted: false };
        }

        const data = await response.json();
        return { success: data.success, alreadyVoted: data.alreadyVoted };
    } catch (e) {
        console.error('[XP Service] Vote exception', e);
        return { success: false, alreadyVoted: false };
    }
}

/**
 * Remove a useful vote (unvote).
 */
export async function removeUsefulVote(voterId: string, materialId: string): Promise<void> {
    await supabaseFetch(
        `useful_votes?voter_id=eq.${voterId}&material_id=eq.${materialId}`,
        { method: 'DELETE' }
    );
}

/**
 * Get all material IDs the user has voted for.
 */
export async function getUserVotes(userId: string): Promise<string[]> {
    const votes = await supabaseFetch<{ material_id: string }[]>(
        `useful_votes?voter_id=eq.${userId}&select=material_id`
    );
    return votes?.map(v => v.material_id) || [];
}

/**
 * Get vote count for a specific material.
 */
export async function getMaterialVoteCount(materialId: string): Promise<number> {
    const votes = await supabaseFetch<any[]>(
        `useful_votes?material_id=eq.${materialId}&select=id`
    );
    return votes?.length || 0;
}

/**
 * Get leaderboard (top users by XP, only those with rank_visible=true).
 */
export async function getLeaderboard(limit: number = 10): Promise<{ id: string; full_name: string; username: string; xp: number }[]> {
    const profiles = await supabaseFetch<any[]>(
        `profiles?rank_visible=eq.true&xp=gt.0&select=id,full_name,username,xp&order=xp.desc&limit=${limit}`
    );
    return profiles || [];
}

/**
 * Toggle rank visibility for a user.
 */
export async function toggleRankVisibility(userId: string, visible: boolean): Promise<void> {
    await supabaseFetch(
        `profiles?id=eq.${userId}`,
        {
            method: 'PATCH',
            preferReturn: 'minimal',
            body: { rank_visible: visible },
        }
    );
}
