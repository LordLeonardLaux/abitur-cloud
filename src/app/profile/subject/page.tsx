'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Profile, Topic } from '@/lib/types';
import { SUBJECTS, SEMESTERS, SUBJECT_COLORS } from '@/lib/constants';
import { ChevronLeft, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

function FriendSemesterAccordion({ semester, subjectId, colorClass, friendId }: { semester: string, subjectId: string, colorClass: string, friendId: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const [topics, setTopics] = useState<Topic[]>([]);
    // const supabase = createClient(); // uses singleton

    useEffect(() => {
        // Always fetch to know the color
        supabase.from('topics').select('*').eq('owner_id', friendId).eq('subject_id', subjectId).eq('semester', semester).order('index').then(({ data }) => setTopics(data || []));
    }, [friendId, subjectId, semester]);

    return (
        <div className="mb-4 rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-white">
            <button onClick={() => setIsOpen(!isOpen)} className={cn("w-full flex items-center justify-between p-6 text-left", isOpen ? "bg-gray-50" : "bg-white hover:bg-gray-50")}>
                <div className="flex items-center gap-4"><div className={cn("w-2 h-8 rounded-full", topics.length > 0 ? "bg-green-500" : "bg-red-500")}></div><span className="text-xl font-semibold text-gray-900">{semester}</span></div>
                {isOpen ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
            </button>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div initial="collapsed" animate="open" exit="collapsed" variants={{ open: { opacity: 1, height: "auto" }, collapsed: { opacity: 0, height: 0 } }}>
                        <div className="px-6 pb-6 pt-2 bg-gray-50 space-y-2">
                            {topics.length === 0 ? <div className="p-4 text-center text-gray-400 text-sm">Keine Themen.</div> : topics.map(t => (
                                <Link key={t.id} href={`/profile/topic?subjectId=${subjectId}&semester=${semester}&id=${t.id}&userId=${friendId}`} className="block p-4 rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-gray-100 text-gray-500"><FileText size={18} /></div><span className="font-medium text-gray-800">{t.title}</span>
                                </Link>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function ProfileSubjectContent() {
    const searchParams = useSearchParams();
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');
    const [profile, setProfile] = useState<Profile | null>(null);
    // const supabase = createClient(); // uses singleton

    useEffect(() => { if (userId) supabase.from('profiles').select('*').eq('id', userId).single().then(({ data }) => setProfile(data)); }, [userId]);
    const subject = SUBJECTS.find(s => s.id === id);
    const colorClass = "bg-blue-500"; // Default color

    if (!subject || !userId) return <div>Not found</div>;

    return (
        <main className="min-h-screen bg-white">
            <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200">
                <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={`/profile?id=${userId}`} className="p-2 -ml-2 rounded-full hover:bg-gray-100"><ChevronLeft className="w-6 h-6 text-gray-600" /></Link>
                        <div><h1 className="text-2xl font-bold tracking-tight text-gray-900">{subject.name}</h1>{profile && <p className="text-xs text-gray-500">von {profile.full_name}</p>}</div>
                    </div>
                </div>
            </div>
            <div className="max-w-3xl mx-auto px-6 py-8 space-y-4">
                {SEMESTERS.map(sem => <FriendSemesterAccordion key={sem} semester={sem} subjectId={subject.id} colorClass={colorClass} friendId={userId} />)}
            </div>
        </main>
    )
}

export default function Page() { return <Suspense fallback={<div>Loading...</div>}><ProfileSubjectContent /></Suspense> }
