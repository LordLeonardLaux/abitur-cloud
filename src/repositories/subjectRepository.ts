/**
 * Subject Repository
 * ===================
 * Data Access Layer - Handles user subjects and subject data.
 */

import { supabaseFetch, supabase } from './baseRepository';

// ============================================================================
// TYPES
// ============================================================================

export interface UserSubject {
    user_id: string;
    subject_id: string;
    subject_type: 'LK' | 'GK' | 'PK';
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Fetches all subjects for a user.
 */
export async function getUserSubjects(userId: string): Promise<UserSubject[]> {
    const subjects = await supabaseFetch<UserSubject[]>(
        `user_subjects?user_id=eq.${userId}`
    );
    return subjects || [];
}

/**
 * Converts user subjects to a map of subjectId -> type.
 */
export async function getUserSubjectsMap(
    userId: string
): Promise<Record<string, string>> {
    const subjects = await getUserSubjects(userId);
    const map: Record<string, string> = {};
    subjects.forEach(s => {
        map[s.subject_id] = s.subject_type;
    });
    return map;
}

/**
 * Fetches subjects for multiple users.
 * Returns a map of userId -> { subjectId -> type }
 */
export async function getSubjectsForUsers(
    userIds: string[]
): Promise<Record<string, Record<string, string>>> {
    if (userIds.length === 0) return {};

    const subjects = await supabaseFetch<UserSubject[]>(
        `user_subjects?user_id=in.(${userIds.join(',')})`
    );

    if (!subjects) return {};

    const grouped: Record<string, Record<string, string>> = {};
    subjects.forEach(s => {
        if (!grouped[s.user_id]) grouped[s.user_id] = {};
        grouped[s.user_id][s.subject_id] = s.subject_type;
    });

    return grouped;
}

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Saves user subject selections.
 * Deletes existing selections and inserts new ones.
 */
export async function saveUserSubjects(
    userId: string,
    subjects: { subjectId: string; type: string }[]
): Promise<boolean> {
    // Delete existing
    await supabase
        .from('user_subjects')
        .delete()
        .eq('user_id', userId);

    // Insert new
    const inserts = subjects.map(s => ({
        user_id: userId,
        subject_id: s.subjectId,
        subject_type: s.type,
    }));

    const { error } = await supabase
        .from('user_subjects')
        .insert(inserts);

    if (error) {
        console.error('[SubjectRepository] Error saving subjects:', error);
        return false;
    }

    return true;
}
