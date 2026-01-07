'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { Profile } from '@/lib/types';

interface AuthContextType {
    user: User | null;
    profile: Profile | null;
    session: Session | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    // const supabase = createClient(); // uses imported singleton

    // Helper: Read session directly from localStorage (bypasses hanging SDK)
    const getSessionFromLocalStorage = (): { user: User | null, session: Session | null, accessToken: string | null } => {
        try {
            if (typeof window === 'undefined') return { user: null, session: null, accessToken: null };

            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
            const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || '';
            const storageKey = `sb-${projectRef}-auth-token`;
            console.log("AuthContext: Looking for session in localStorage key:", storageKey);

            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                console.log("AuthContext: Found session in localStorage, user:", parsed.user?.id);
                return {
                    user: parsed.user as User,
                    session: parsed as Session,
                    accessToken: parsed.access_token
                };
            }
        } catch (e) {
            console.error("AuthContext: Error reading session from localStorage:", e);
        }
        return { user: null, session: null, accessToken: null };
    };

    useEffect(() => {
        const initAuth = () => {
            console.log("AuthContext: Initializing auth from localStorage...");

            // First, try to get session from localStorage (instant, no network)
            const { user: storedUser, session: storedSession, accessToken } = getSessionFromLocalStorage();

            if (storedUser && storedSession && accessToken) {
                console.log("AuthContext: Session found in localStorage, user:", storedUser.id);
                setSession(storedSession);
                setUser(storedUser);
                // Fetch profile using raw fetch to avoid SDK hang
                fetchProfileRaw(storedUser.id, accessToken);
            } else {
                console.log("AuthContext: No session in localStorage, user needs to login");
            }

            setLoading(false);
        };

        initAuth();

        // Still listen for auth state changes (for login/logout events)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            console.log("AuthContext: onAuthStateChange event:", _event);
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                // Use raw fetch for profile
                fetchProfileRaw(session.user.id, session.access_token);
            } else {
                setProfile(null);
            }
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Fetch profile using raw fetch (bypasses SDK hang)
    const fetchProfileRaw = async (userId: string, token: string) => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`, {
                method: 'GET',
                headers: {
                    'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data[0]) {
                    setProfile(data[0]);
                }
            }
        } catch (e) {
            console.error("AuthContext: Failed to fetch profile:", e);
        }
    };

    const fetchProfile = async (userId: string) => {
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        setProfile(data);
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        setSession(null);
    };

    return (
        <AuthContext.Provider value={{ user, profile, session, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
