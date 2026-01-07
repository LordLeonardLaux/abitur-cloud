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

function ProfileContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const userId = searchParams.get('id');
    const { user } = useAuth();

    const [profile, setProfile] = useState<Profile | null>(null);
    const [topics, setTopics] = useState<Record<string, boolean>>({});
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
        <main className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-5xl mx-auto space-y-8">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard" className="p-2 -ml-2 rounded-full hover:bg-gray-200"><ChevronLeft className="w-6 h-6 text-gray-600" /></Link>
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg">{profile.full_name?.charAt(0)}</div>
                        <div><h1 className="text-3xl font-bold text-gray-900">{profile.full_name}</h1><p className="text-gray-500 font-medium">@{profile.username}</p></div>
                    </div>
                </div>
                <div>
                    <h2 className="flex items-center gap-2 text-xl font-bold text-gray-800 mb-6"><GraduationCap className="text-blue-500" /> Fächer</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {SUBJECTS.map(s => (
                            <Link key={s.id} href={`/profile/subject?id=${s.id}&userId=${userId}`} className="group bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all">
                                <div className={cn("w-3 h-3 rounded-full mb-4", topics[s.id] ? "bg-green-500" : "bg-red-500")}></div>
                                <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600">{s.name}</h3>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </main>
    );
}

export default function ProfilePage() {
    return <Suspense fallback={<div>Loading...</div>}><ProfileContent /></Suspense>
}
