/**
 * Friendship Repository
 * ======================
 * Data Access Layer - Handles all friendship-related database operations.
 * Uses Supabase SDK directly for reliable auth and error handling.
 */

import { supabase } from '@/lib/supabase/client';

// ============================================================================
// TYPES
// ============================================================================

export interface Friendship {
    id: string;
    user_id: string;
    friend_id: string;
    status: 'pending' | 'accepted' | 'rejected';
    created_at: string;
}

export interface FriendshipWithProfile extends Friendship {
    profile?: {
        id: string;
        full_name: string;
        username: string;
    };
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Fetches all accepted friendships for a user.
 */
export async function getAcceptedFriendships(userId: string): Promise<Friendship[]> {
    const { data, error } = await supabase
        .from('friendships')
        .select('*')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
        .eq('status', 'accepted');

    if (error) {
        console.error('[friendshipRepo] getAcceptedFriendships error:', error);
        return [];
    }
    return data || [];
}

/**
 * Extracts friend IDs from a list of friendships.
 */
export function extractFriendIds(userId: string, friendships: Friendship[]): string[] {
    return friendships.map(f =>
        f.user_id === userId ? f.friend_id : f.user_id
    );
}

/**
 * Fetches pending friendship requests sent to a user.
 */
export async function getPendingRequests(userId: string): Promise<Friendship[]> {
    const { data, error } = await supabase
        .from('friendships')
        .select('*')
        .eq('friend_id', userId)
        .eq('status', 'pending');

    if (error) {
        console.error('[friendshipRepo] getPendingRequests error:', error);
        return [];
    }
    return data || [];
}

/**
 * Checks if a friendship exists between two users (in any direction).
 */
export async function checkExistingFriendship(
    userId: string,
    friendId: string
): Promise<Friendship | null> {
    const { data, error } = await supabase
        .from('friendships')
        .select('*')
        .or(
            `and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`
        );

    if (error) {
        console.error('[friendshipRepo] checkExistingFriendship error:', error);
        return null;
    }
    return data?.[0] || null;
}

/**
 * Fetches IDs of users the current user has sent pending requests to.
 */
export async function getSentPendingRequests(userId: string): Promise<string[]> {
    const { data, error } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', userId)
        .eq('status', 'pending');

    if (error) {
        console.error('[friendshipRepo] getSentPendingRequests error:', error);
        return [];
    }
    return (data || []).map(r => r.friend_id);
}

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Creates a new friendship request.
 */
export async function createFriendshipRequest(
    userId: string,
    friendId: string
): Promise<boolean> {
    console.log('[friendshipRepo] Creating friendship request:', userId, '->', friendId);

    const { error } = await supabase
        .from('friendships')
        .insert({
            user_id: userId,
            friend_id: friendId,
            status: 'pending',
        });

    if (error) {
        console.error('[friendshipRepo] createFriendshipRequest error:', error);
        return false;
    }

    console.log('[friendshipRepo] Friendship request created successfully');
    return true;
}

/**
 * Updates the status of a friendship.
 */
export async function updateFriendshipStatus(
    friendshipId: string,
    status: 'accepted' | 'rejected'
): Promise<boolean> {
    const { error } = await supabase
        .from('friendships')
        .update({ status })
        .eq('id', friendshipId);

    if (error) {
        console.error('[friendshipRepo] updateFriendshipStatus error:', error);
        return false;
    }
    return true;
}

/**
 * Deletes a friendship request.
 */
export async function deleteFriendship(friendshipId: string): Promise<boolean> {
    const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);

    if (error) {
        console.error('[friendshipRepo] deleteFriendship error:', error);
        return false;
    }
    return true;
}
