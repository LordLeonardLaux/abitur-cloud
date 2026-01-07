'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const publicRoutes = ['/login', '/signup'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    // Normalize pathname to remove trailing slash for consistent matching
    const normalizedPath = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;

    useEffect(() => {
        if (!loading) {
            if (!user && !publicRoutes.includes(normalizedPath)) {
                // Determine valid redirect path
                if (pathname === '/' || pathname === '') {
                    router.push('/login');
                } else {
                    router.push('/login');
                }
            } else if (user && publicRoutes.includes(normalizedPath)) {
                router.push('/dashboard');
            }
        }
    }, [user, loading, normalizedPath, pathname, router]);

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

    return <>{children}</>;
}
