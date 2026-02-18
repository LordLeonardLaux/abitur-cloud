'use client';

/**
 * Auth Context (Refactored)
 * ==========================
 * Provides authentication state across the application.
 * Uses authService for session management.
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { Profile } from '@/lib/types';
import * as authService from '@/services/authService';

// ============================================================================
// TYPES
// ============================================================================

interface AuthContextType {
    user: User | null;
    profile: Profile | null;
    session: Session | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

// ============================================================================
// CONTEXT
// ============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            console.log("[AuthContext] Initializing auth from localStorage...");

            // Get session from localStorage (instant, no network)
            const { user: storedUser, session: storedSession } = authService.getCurrentSession();

            if (storedUser && storedSession) {
                console.log("[AuthContext] Session found, user:", storedUser.id);
                setSession(storedSession);
                setUser(storedUser);

                // Fetch profile using service
                const userProfile = await authService.fetchUserProfile(storedUser.id);
                if (userProfile) {
                    setProfile(userProfile);
                }
            } else {
                console.log("[AuthContext] No session found, user needs to login");
            }

            setLoading(false);
        };

        initAuth();

        // Listen for auth state changes (login/logout)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
            console.log("[AuthContext] Auth state changed:", _event);
            setSession(newSession);
            setUser(newSession?.user ?? null);

            if (newSession?.user) {
                const userProfile = await authService.fetchUserProfile(newSession.user.id);
                setProfile(userProfile);
            } else {
                setProfile(null);
            }

            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleSignOut = async () => {
        await authService.signOutUser();
        setUser(null);
        setProfile(null);
        setSession(null);
    };

    return (
        <AuthContext.Provider value={{ user, profile, session, loading, signOut: handleSignOut }}>
            {children}
        </AuthContext.Provider>
    );
}

// ============================================================================
// HOOK
// ============================================================================

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
