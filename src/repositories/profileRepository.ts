/**
 * Profile Repository
 * ===================
 * Data Access Layer - Handles all profile-related database operations.
 */

import { Profile } from '@/lib/types';
import { supabaseFetch } from './baseRepository';

/**
 * Fetches a single profile by ID.
 */
export async function getProfileById(id: string): Promise<Profile | null> {
    const profiles = await supabaseFetch<Profile[]>(
        `profiles?id=eq.${id}&select=*`
    );
    return profiles?.[0] || null;
}

/**
 * Fetches multiple profiles by their IDs.
 */
export async function getProfilesByIds(ids: string[]): Promise<Profile[]> {
    if (ids.length === 0) return [];

    const profiles = await supabaseFetch<Profile[]>(
        `profiles?id=in.(${ids.join(',')})`
    );
    return profiles || [];
}

/**
 * Searches for profiles by username, full name, or email.
 * Excludes the current user from results.
 */
export async function searchProfiles(
    query: string,
    excludeUserId: string,
    limit: number = 10
): Promise<Profile[]> {
    const encodedQuery = encodeURIComponent(query);
    const profiles = await supabaseFetch<Profile[]>(
        `profiles?or=(username.ilike.*${encodedQuery}*,full_name.ilike.*${encodedQuery}*,email.ilike.*${encodedQuery}*)&id=neq.${excludeUserId}&limit=${limit}`
    );
    return profiles || [];
}

/**
 * Fetches suggested users based on grade level.
 * Returns users in the same grade who are not already friends.
 */
export async function getSuggestedProfiles(
    gradeLevel: string,
    excludeUserId: string,
    excludeFriendIds: string[],
    limit: number = 3
): Promise<Profile[]> {
    let query = `profiles?grade_level=eq.${gradeLevel}&id=neq.${excludeUserId}&limit=${limit * 2}`;

    // Exclude existing friends
    if (excludeFriendIds.length > 0) {
        query += `&id=not.in.(${excludeFriendIds.join(',')})`;
    }

    const profiles = await supabaseFetch<Profile[]>(query);
    return (profiles || []).slice(0, limit);
}
