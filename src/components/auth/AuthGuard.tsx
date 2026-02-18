'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { MobileTabBar } from '@/components/dashboard/MobileTabBar';

const publicRoutes = ['/login', '/signup', '/auth/reset-password', '/auth/pending'];
const noTabBarRoutes = ['/admin', '/teacher', '/login', '/signup', '/auth'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, profile, loading } = useAuth(); // Destructure profile
    const router = useRouter();
    const pathname = usePathname();
    // Normalize pathname to remove trailing slash for consistent matching
    const normalizedPath = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;

    const showTabBar = user && !noTabBarRoutes.some(r => normalizedPath.startsWith(r));

    useEffect(() => {
        if (!loading) {
            // Case 1: Not logged in
            if (!user && !publicRoutes.includes(normalizedPath)) {
                // Determine valid redirect path
                if (pathname === '/' || pathname === '') {
                    router.push('/login');
                } else {
                    router.push('/login');
                }
            }
            // Case 2: Logged in but NOT approved (and not already on pending page)
            else if (user && profile && !profile.is_approved && normalizedPath !== '/auth/pending') {
                router.push('/auth/pending');
            }
            // Case 3: Logged in AND approved (and tries to access public route like login)
            else if (user && profile?.is_approved && publicRoutes.includes(normalizedPath) && normalizedPath !== '/auth/pending') {
                router.push('/dashboard');
            }
        }
    }, [user, profile, loading, normalizedPath, pathname, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <p className="text-gray-400 text-sm">Laden...</p>
            </div>
        );
    }

    // Allow public routes without auth
    if (publicRoutes.includes(normalizedPath)) {
        return <>{children}</>;
    }

    // Require auth for protected routes
    if (!user) {
        // Show a visual indicator instead of null/white screen while redirecting
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <p className="text-gray-400">Leite weiter zum Login...</p>
            </div>
        );
    }

    return (
        <>
            <div className={showTabBar ? 'pb-20 md:pb-0' : ''}>
                {children}
            </div>
            {showTabBar && <MobileTabBar />}
        </>
    );
}

