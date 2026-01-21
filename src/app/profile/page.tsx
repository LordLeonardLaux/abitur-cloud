'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Profile } from '@/lib/types';
import { SUBJECTS, SUBJECT_COLORS } from '@/lib/constants';
import { ChevronLeft, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/dashboard/Sidebar';

function ProfileContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const userId = searchParams.get('id');
    const { user } = useAuth();

    const [profile, setProfile] = useState<Profile | null>(null);
    const [topics, setTopics] = useState<Record<string, boolean>>({});
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    // const supabase = createClient(); // uses singleton

    useEffect(() => {
        if (user && userId === user.id) {
            router.replace('/dashboard');
            return;
        }
        if (userId) {
            supabase.from('profiles').select('*').eq('id', userId).single().then(({ data }) => setProfile(data));

            // Fetch all topics for this user to determine content availability
            supabase.from('topics').select('subject_id')
                .eq('owner_id', userId)
                .then(({ data }) => {
                    const topicMap: Record<string, boolean> = {};
                    data?.forEach((t: any) => {
                        topicMap[t.subject_id] = true;
                    });
                    setTopics(topicMap);
                });
        }
    }, [userId, user, router]);

    if (!profile) return <div>Loading...</div>;

    return (
        <main className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-5xl mx-auto space-y-8">
                <div className="flex items-center justify-between gap-4 px-2">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="p-2 -ml-2 rounded-full hover:bg-gray-200">
                            <ChevronLeft className="w-6 h-6 text-gray-600" />
                        </Link>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl md:text-2xl shadow-lg">
                                {profile.full_name?.charAt(0)}
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{profile.full_name}</h1>
                                <p className="text-gray-500 font-medium text-sm">@{profile.username}</p>
                            </div>
                        </div>
                    </div>
                    {/* Mobile Burger Menu Inline */}
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="md:hidden p-2 bg-white border border-gray-100 shadow-sm rounded-xl text-gray-900 active:scale-95"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                    </button>
                </div>
                <div>
                    <h2 className="flex items-center gap-2 text-xl font-bold text-gray-800 mb-6"><GraduationCap className="text-blue-500" /> Fächer</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {SUBJECTS.map(s => (
                            <Link key={s.id} href={`/profile/subject?id=${s.id}&userId=${userId}`} className="group bg-white rounded-2xl p-4 md:p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all">
                                <div className={cn("w-3 h-3 rounded-full mb-3 md:mb-4", topics[s.id] ? "bg-green-500" : "bg-red-500")}></div>
                                <h3 className="text-base md:text-lg font-bold text-gray-900 group-hover:text-blue-600">{s.name}</h3>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
            {/* Sidebar Component */}
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        </main>
    );
}

export default function ProfilePage() {
    return <Suspense fallback={<div>Loading...</div>}><ProfileContent /></Suspense>
}
