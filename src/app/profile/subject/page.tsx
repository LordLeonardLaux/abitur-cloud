'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Profile, Topic } from '@/lib/types';
import { SUBJECTS, SEMESTERS, SUBJECT_COLORS } from '@/lib/constants';
import { ChevronLeft, ChevronDown, ChevronRight, FileText, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from '@/components/dashboard/Sidebar';

function FriendSemesterAccordion({ semester, subjectId, colorClass, friendId }: { semester: string, subjectId: string, colorClass: string, friendId: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const [topics, setTopics] = useState<Topic[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        import('@/repositories/baseRepository').then(({ supabaseFetch }) => {
            supabaseFetch<Topic[]>(`topics?owner_id=eq.${friendId}&subject_id=eq.${subjectId}&semester=eq.${semester}&order=index`)
                .then(data => {
                    setTopics(data || []);
                    setLoading(false);
                });
        });
    }, [friendId, subjectId, semester]);

    return (
        <div className="mb-4 rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-white">
            <button onClick={() => setIsOpen(!isOpen)} className={cn("w-full flex items-center justify-between p-6 text-left transition-colors", isOpen ? "bg-gray-50" : "bg-white hover:bg-gray-50")}>
                <div className="flex items-center gap-4">
                    <div className={cn("w-2 h-8 rounded-full", topics.length > 0 ? "bg-green-500" : "bg-red-500")}></div>
                    <span className="text-xl font-bold text-gray-900">{semester}</span>
                </div>
                {isOpen ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
            </button>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div initial="collapsed" animate="open" exit="collapsed" variants={{ open: { opacity: 1, height: "auto" }, collapsed: { opacity: 0, height: 0 } }} transition={{ duration: 0.3, ease: "easeInOut" }}>
                        <div className="px-4 pb-6 pt-2 bg-gray-50 space-y-2">
                            {loading ? (
                                <div className="p-8 text-center text-gray-400 text-sm font-medium">Lade Themen...</div>
                            ) : topics.length === 0 ? (
                                <div className="p-8 text-center text-gray-400 text-sm font-medium">Keine Themen vorhanden.</div>
                            ) : (
                                topics.map(t => (
                                    <Link key={t.id} href={`/profile/topic?subjectId=${subjectId}&semester=${semester}&id=${t.id}&userId=${friendId}`} className="block p-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center gap-4 group">
                                        <div className="p-3 rounded-xl bg-gray-50 text-gray-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                            <FileText size={20} />
                                        </div>
                                        <span className="font-bold text-gray-800">{t.title}</span>
                                        <ChevronRight className="w-4 h-4 ml-auto text-gray-300 group-hover:text-blue-400" />
                                    </Link>
                                ))
                            )}
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
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        if (userId) {
            import('@/repositories/baseRepository').then(({ supabaseFetch }) => {
                supabaseFetch<Profile[]>(`profiles?id=eq.${userId}`).then(data => {
                    if (data && data.length > 0) setProfile(data[0]);
                });
            });
        }
    }, [userId]);

    const subject = SUBJECTS.find(s => s.id === id);
    const colorClass = "bg-blue-500";

    if (!subject || !userId) return <div className="p-10 text-center">Not found</div>;

    return (
        <main className="min-h-screen bg-gray-50">
            {/* Standardized Header */}
            <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200">
                <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href={`/profile?id=${userId}`} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
                            <ChevronLeft className="w-6 h-6 text-gray-600" />
                        </Link>
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900 leading-tight">{subject.name}</h1>
                            {profile && <p className="text-[10px] md:text-xs text-gray-400 uppercase font-black tracking-widest">von {profile.full_name}</p>}
                        </div>
                    </div>
                    {/* Mobile Burger Menu Inline */}
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="md:hidden p-2 bg-white border border-gray-100 shadow-sm rounded-xl text-gray-900 active:scale-95 transition-transform"
                    >
                        <Menu size={24} />
                    </button>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
                {SEMESTERS.map(sem => <FriendSemesterAccordion key={sem} semester={sem} subjectId={subject.id} colorClass={colorClass} friendId={userId} />)}
            </div>

            {/* Nav Sidebar Component */}
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        </main>
    );
}

export default function Page() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
            <ProfileSubjectContent />
        </Suspense>
    );
}
