'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SUBJECTS } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen, Calendar, GraduationCap } from 'lucide-react';
import { GradeMigrationModal } from '@/components/GradeMigrationModal';
import { cn } from '@/lib/utils';
import { Sidebar } from '@/components/dashboard/Sidebar';

export default function DashboardPage() {
    const { user, profile } = useAuth();

    const [userSubjects, setUserSubjects] = useState<Record<string, string>>({}); // subjectId -> type
    const [loadingSubjects, setLoadingSubjects] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Helper: Read token directly from localStorage (bypasses hanging SDK)
    const getTokenFromLocalStorage = (): string | null => {
        try {
            // Priority 1: Search for any key matching the Supabase pattern
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
                    const stored = localStorage.getItem(key);
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        return parsed.access_token || null;
                    }
                }
            }
        } catch (e) {
            console.error("Error reading token from localStorage:", e);
        }
        return null;
    };

    // Fetch user subjects using raw fetch
    useEffect(() => {
        async function loadUserSubjects() {
            if (!user) return;
            const token = getTokenFromLocalStorage();
            if (!token) {
                setLoadingSubjects(false);
                return;
            }

            try {
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_subjects?user_id=eq.${user.id}`,
                    {
                        headers: {
                            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                            'Authorization': `Bearer ${token}`,
                        }
                    }
                );
                if (res.ok) {
                    const data = await res.json();
                    const map: Record<string, string> = {};
                    data.forEach((s: any) => {
                        map[s.subject_id] = s.subject_type;
                    });
                    setUserSubjects(map);
                    console.log("Loaded subjects:", map);
                }
            } catch (e) {
                console.error("Failed to load subjects:", e);
            } finally {
                setLoadingSubjects(false);
            }
        }
        loadUserSubjects();
    }, [user]);

    // Filter subjects based on user selection
    const displayedSubjects = SUBJECTS.filter(s => !!userSubjects[s.id]);
    const hasSubjects = Object.keys(userSubjects).length > 0;

    return (
        <div className="flex h-screen bg-white overflow-hidden">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Main Content */}
                <main className="flex-1 p-4 md:p-8 overflow-hidden pb-24 md:pb-8">
                    <div className="max-w-5xl mx-auto">
                        {profile && <GradeMigrationModal user={profile} onUpdate={() => window.location.reload()} />}

                        <div className="flex items-center justify-between mb-6 pt-2">
                            <h2 className="text-2xl font-bold text-gray-900">Meine Fächer</h2>
                            <div className="flex items-center gap-2">
                                <Link
                                    href="/subjects/selection"
                                    className="hidden md:block bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                                >
                                    Fächer bearbeiten
                                </Link>
                                {/* Mobile Burger Menu Inline */}
                                <button
                                    onClick={() => setIsSidebarOpen(true)}
                                    className="md:hidden p-2 bg-white border border-gray-100 shadow-sm rounded-xl text-gray-900 active:scale-95"
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                                </button>
                            </div>
                        </div>

                        {!hasSubjects && !loadingSubjects ? (
                            <div className="bg-white p-10 rounded-2xl border border-gray-100 shadow-sm text-center">
                                <h3 className="text-xl font-semibold text-gray-900 mb-2">Keine Fächer ausgewählt</h3>
                                <p className="text-gray-500 mb-6">Wähle deine Kurse aus, um zu starten.</p>
                                <Link
                                    href="/subjects/selection"
                                    className="inline-block bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-500 transition-colors"
                                >
                                    Jetzt fächer wählen
                                </Link>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                {displayedSubjects.map((subject) => {
                                    const colorClass = "bg-blue-500";
                                    const typeLabel = userSubjects[subject.id];
                                    return (
                                        <Link
                                            key={subject.id}
                                            href={`/subject?id=${subject.id}`}
                                            className="group relative bg-white rounded-2xl p-4 md:p-6 border border-gray-100 shadow-sm hover:shadow-lg hover:border-gray-200 transition-all"
                                        >
                                            <div className={cn("w-3 h-3 rounded-full mb-3 md:mb-4", colorClass)}></div>
                                            <h3 className="text-base md:text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                                                {subject.name}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1 md:mt-2">
                                                <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] md:text-xs font-bold uppercase">
                                                    {typeLabel}
                                                </span>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}

                        {/* Quick Access Tiles - Below Subjects */}
                        <div className={cn(
                            "grid gap-3 md:gap-4 mt-8",
                            profile?.role === 'teacher' ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2"
                        )}>
                            {profile?.role === 'teacher' && (
                                <Link href="/teacher/dashboard" className="group relative overflow-hidden bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-4 md:p-6 shadow-sm hover:shadow-md transition-all">
                                    <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 rounded-full bg-white/10 blur-2xl"></div>
                                    <div className="relative z-10 flex flex-col h-full justify-between text-white">
                                        <GraduationCap className="w-6 h-6 md:w-8 md:h-8 mb-3 md:mb-4 opacity-90" />
                                        <div>
                                            <h3 className="text-sm md:text-lg font-bold">Lehrer-Dashboard</h3>
                                            <p className="text-amber-100 text-[10px] md:text-xs mt-1">Materialverwaltung</p>
                                        </div>
                                    </div>
                                </Link>
                            )}
                            <Link href="/exams" className="group relative overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-4 md:p-6 shadow-sm hover:shadow-md transition-all">
                                <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 rounded-full bg-white/10 blur-2xl"></div>
                                <div className="relative z-10 flex flex-col h-full justify-between text-white">
                                    <BookOpen className="w-6 h-6 md:w-8 md:h-8 mb-3 md:mb-4 opacity-90" />
                                    <div>
                                        <h3 className="text-sm md:text-lg font-bold">Klausuren</h3>
                                        <p className="text-indigo-100 text-[10px] md:text-xs mt-1">Suchen & Finden</p>
                                    </div>
                                </div>
                            </Link>
                            <Link href="/materials" className="group relative overflow-hidden bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl p-4 md:p-6 shadow-sm hover:shadow-md transition-all">
                                <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 rounded-full bg-white/10 blur-2xl"></div>
                                <div className="relative z-10 flex flex-col h-full justify-between text-white">
                                    <Calendar className="w-6 h-6 md:w-8 md:h-8 mb-3 md:mb-4 opacity-90" />
                                    <div>
                                        <h3 className="text-sm md:text-lg font-bold">Kalender</h3>
                                        <p className="text-emerald-100 text-[10px] md:text-xs mt-1">Smartboard</p>
                                    </div>
                                </div>
                            </Link>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
