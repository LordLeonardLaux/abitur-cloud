/**
 * Auth Service
 * =============
 * Business Logic Layer - Authentication and session management.
 */

import { User, Session } from '@supabase/supabase-js';
import { Profile } from '@/lib/types';
import { supabase, getAccessToken } from '@/repositories/baseRepository';
import { getProfileById } from '@/repositories/profileRepository';

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Gets the current session from localStorage.
 * Returns user, session, and access token.
 */
export function getCurrentSession(): {
    user: User | null;
    session: Session | null;
    accessToken: string | null;
} {
    try {
        if (typeof window === 'undefined') {
            return { user: null, session: null, accessToken: null };
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || '';
        const storageKey = `sb-${projectRef}-auth-token`;

        const stored = localStorage.getItem(storageKey);
        if (stored) {
            const parsed = JSON.parse(stored);
            return {
                user: parsed.user as User,
                session: parsed as Session,
                accessToken: parsed.access_token,
            };
        }
    } catch (e) {
        console.error('[AuthService] Error reading session:', e);
    }

    return { user: null, session: null, accessToken: null };
}

// ============================================================================
// PROFILE MANAGEMENT
// ============================================================================

/**
 * Fetches the profile for a given user ID.
 */
export async function fetchUserProfile(userId: string): Promise<Profile | null> {
    return getProfileById(userId);
}

// ============================================================================
// AUTHENTICATION ACTIONS
// ============================================================================

/**
 * Signs out the current user.
 */
export async function signOutUser(): Promise<void> {
    await supabase.auth.signOut();
}

/**
 * Signs in a user with email and password.
 */
export async function signInWithEmail(
    email: string,
    password: string
): Promise<{ user: User | null; error: string | null }> {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        return { user: null, error: error.message };
    }

    return { user: data.user, error: null };
}

/**
 * Creates a new user account.
 */
export async function signUpWithEmail(
    email: string,
    password: string,
    metadata: { username: string; full_name: string }
): Promise<{ user: User | null; error: string | null }> {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: metadata,
        },
    });

    if (error) {
        return { user: null, error: error.message };
    }

    return { user: data.user, error: null };
}

/**
 * Creates a profile record for a new user.
 */
export async function createUserProfile(profile: {
    id: string;
    username: string;
    full_name: string;
    grade_level: string;
    role: 'student' | 'teacher';
    school: string;
}): Promise<{ error: string | null }> {
    const { error } = await supabase
        .from('profiles')
        .insert({
            ...profile,
            avatar_url: null,
        });

    if (error) {
        return { error: error.message };
    }

    return { error: null };
}
