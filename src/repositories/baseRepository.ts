/**
 * Base Repository
 * ================
 * Data Access Layer - Shared utilities for all repositories.
 * Handles authentication tokens, typed fetch calls, and error handling.
 */

import { supabase } from '@/lib/supabase/client';

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

/**
 * Retrieves the Supabase access token from localStorage.
 * Centralized here to avoid duplication across components.
 */
export function getAccessToken(): string | null {
    try {
        if (typeof window === 'undefined') return null;

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || '';
        const storageKey = `sb-${projectRef}-auth-token`;

        const stored = localStorage.getItem(storageKey);
        if (stored) {
            const parsed = JSON.parse(stored);
            return parsed.access_token || null;
        }
    } catch (e) {
        console.error('[BaseRepository] Error reading token:', e);
    }
    return null;
}

/**
 * Retrieves the current user ID from localStorage session.
 */
export function getCurrentUserId(): string | null {
    try {
        if (typeof window === 'undefined') return null;

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || '';
        const storageKey = `sb-${projectRef}-auth-token`;

        const stored = localStorage.getItem(storageKey);
        if (stored) {
            const parsed = JSON.parse(stored);
            return parsed.user?.id || null;
        }
    } catch (e) {
        console.error('[BaseRepository] Error reading user ID:', e);
    }
    return null;
}

// ============================================================================
// TYPED FETCH HELPERS
// ============================================================================

interface FetchOptions {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    preferReturn?: 'minimal' | 'representation';
}

/**
 * Typed fetch wrapper for Supabase REST API.
 * Automatically handles authentication headers and JSON parsing.
 * 
 * @param endpoint - The REST endpoint (e.g., 'profiles?id=eq.123')
 * @param options - Fetch options
 * @returns Parsed JSON response or null on error
 */
export async function supabaseFetch<T>(
    endpoint: string,
    options: FetchOptions = {}
): Promise<T | null> {
    const token = getAccessToken();
    if (!token) {
        console.error('[BaseRepository] No access token available');
        return null;
    }

    const { method = 'GET', body, preferReturn } = options;

    const headers: Record<string, string> = {
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };

    if (preferReturn) {
        headers['Prefer'] = `return=${preferReturn}`;
    }

    try {
        const response = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${endpoint}`,
            {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[BaseRepository] Fetch failed: ${response.status} ${response.statusText}`, errText);
            return null;
        }

        // Handle empty responses (e.g., POST/DELETE with return=minimal → 201/204)
        const text = await response.text();
        if (!text) {
            // Return a truthy marker for successful empty responses
            return {} as T;
        }

        return JSON.parse(text) as T;
    } catch (error) {
        console.error('[BaseRepository] Fetch error:', error);
        return null;
    }
}

// ============================================================================
// SUPABASE SDK WRAPPER
// ============================================================================

/**
 * Re-export the Supabase client for SDK-based queries.
 * Use this for complex queries that benefit from the SDK's query builder.
 */
export { supabase };
