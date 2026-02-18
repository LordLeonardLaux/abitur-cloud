/**
 * Friendship Repository
 * ======================
 * Data Access Layer - Handles all friendship-related database operations.
 */

import { supabaseFetch } from './baseRepository';

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
 * Returns the IDs of the user's friends.
 */
export async function getAcceptedFriendships(userId: string): Promise<Friendship[]> {
    const friendships = await supabaseFetch<Friendship[]>(
        `friendships?or=(user_id.eq.${userId},friend_id.eq.${userId})&status=eq.accepted`
    );
    return friendships || [];
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
    const requests = await supabaseFetch<Friendship[]>(
        `friendships?friend_id=eq.${userId}&status=eq.pending`
    );
    return requests || [];
}

/**
 * Checks if a friendship exists between two users (in any direction).
 */
export async function checkExistingFriendship(
    userId: string,
    friendId: string
): Promise<Friendship | null> {
    const existing = await supabaseFetch<Friendship[]>(
        `friendships?or=(and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId}))`
    );
    return existing?.[0] || null;
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
    const result = await supabaseFetch<Friendship>(
        'friendships',
        {
            method: 'POST',
            body: { user_id: userId, friend_id: friendId, status: 'pending' },
            preferReturn: 'minimal',
        }
    );
    return result !== null;
}

/**
 * Updates the status of a friendship.
 */
export async function updateFriendshipStatus(
    friendshipId: string,
    status: 'accepted' | 'rejected'
): Promise<boolean> {
    const result = await supabaseFetch<Friendship>(
        `friendships?id=eq.${friendshipId}`,
        {
            method: 'PATCH',
            body: { status },
            preferReturn: 'minimal',
        }
    );
    return result !== null;
}

/**
 * Deletes a friendship request.
 */
export async function deleteFriendship(friendshipId: string): Promise<boolean> {
    const result = await supabaseFetch<null>(
        `friendships?id=eq.${friendshipId}`,
        { method: 'DELETE' }
    );
    return true; // DELETE returns empty, so we assume success if no error
}
