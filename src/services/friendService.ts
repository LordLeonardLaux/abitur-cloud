/**
 * Friend Service
 * ===============
 * Business Logic Layer - Friend management and suggestions.
 */

import { Profile } from '@/lib/types';
import * as profileRepo from '@/repositories/profileRepository';
import * as friendshipRepo from '@/repositories/friendshipRepository';
import * as subjectRepo from '@/repositories/subjectRepository';

// ============================================================================
// TYPES
// ============================================================================

export interface FriendWithSubjects extends Profile {
    subjects: Record<string, string>; // subjectId -> type (LK, GK, PK)
}

export interface PendingRequest {
    id: string;
    profile: Profile;
    created_at: string;
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Fetches all friends for a user with their subject selections.
 * This is the main function used by the Sidebar component.
 */
export async function getFriendsWithSubjects(
    userId: string
): Promise<FriendWithSubjects[]> {
    // Get accepted friendships
    const friendships = await friendshipRepo.getAcceptedFriendships(userId);
    if (friendships.length === 0) return [];

    // Extract friend IDs
    const friendIds = friendshipRepo.extractFriendIds(userId, friendships);

    // Fetch friend profiles
    const profiles = await profileRepo.getProfilesByIds(friendIds);

    // Fetch subjects for all friends
    const subjectsMap = await subjectRepo.getSubjectsForUsers(friendIds);

    // Combine data
    return profiles.map(profile => ({
        ...profile,
        subjects: subjectsMap[profile.id] || {},
    }));
}

/**
 * Fetches pending friend requests with requester profiles.
 */
export async function getPendingRequestsWithProfiles(
    userId: string
): Promise<PendingRequest[]> {
    const requests = await friendshipRepo.getPendingRequests(userId);
    if (requests.length === 0) return [];

    const requesterIds = requests.map(r => r.user_id);
    const profiles = await profileRepo.getProfilesByIds(requesterIds);

    return requests.map(req => ({
        id: req.id,
        profile: profiles.find(p => p.id === req.user_id)!,
        created_at: req.created_at,
    })).filter(req => req.profile);
}

/**
 * Gets friend suggestions based on grade level.
 */
export async function getSuggestions(
    userId: string,
    gradeLevel: string | undefined,
    currentFriendIds: string[]
): Promise<Profile[]> {
    if (!gradeLevel) return [];

    return profileRepo.getSuggestedProfiles(
        gradeLevel,
        userId,
        currentFriendIds,
        3
    );
}

/**
 * Searches for users to add as friends.
 */
export async function searchUsers(
    query: string,
    currentUserId: string
): Promise<Profile[]> {
    if (!query.trim()) return [];
    return profileRepo.searchProfiles(query, currentUserId);
}

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Sends a friend request or accepts an existing one.
 * If the target user already sent a request, it gets accepted instead.
 */
export async function sendOrAcceptFriendRequest(
    userId: string,
    friendId: string
): Promise<{ success: boolean; action: 'sent' | 'accepted' | 'exists' }> {
    // Check for existing friendship
    const existing = await friendshipRepo.checkExistingFriendship(userId, friendId);

    if (existing) {
        if (existing.user_id === friendId && existing.status === 'pending') {
            // They already sent us a request - accept it
            await friendshipRepo.updateFriendshipStatus(existing.id, 'accepted');
            return { success: true, action: 'accepted' };
        }
        // Already friends or we already sent a request
        return { success: false, action: 'exists' };
    }

    // Create new request
    const created = await friendshipRepo.createFriendshipRequest(userId, friendId);
    return { success: created, action: 'sent' };
}

/**
 * Accepts a pending friend request.
 */
export async function acceptFriendRequest(requestId: string): Promise<boolean> {
    return friendshipRepo.updateFriendshipStatus(requestId, 'accepted');
}

/**
 * Rejects/deletes a friend request.
 */
export async function rejectFriendRequest(requestId: string): Promise<boolean> {
    return friendshipRepo.deleteFriendship(requestId);
}
