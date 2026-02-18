'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { SUBJECTS, SEMESTERS, SUBJECT_COLORS } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { Topic, TeacherMaterial } from '@/lib/types';
import { ChevronLeft, ChevronDown, ChevronRight, FileText, Plus, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from '@/components/dashboard/Sidebar';

function SemesterAccordion({ semester, subjectId, colorClass, userId, isOwner }: { semester: string, subjectId: string, colorClass: string, userId: string, isOwner: boolean }) {
    const [isOpen, setIsOpen] = useState(false);
    const [topics, setTopics] = useState<Topic[]>([]);
    const [teacherMaterials, setTeacherMaterials] = useState<TeacherMaterial[]>([]);
    const [loading, setLoading] = useState(false);
    // const supabase = createClient(); // uses singleton

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            // Fetch student topics
            supabase
                .from('topics')
                .select('*')
                .eq('owner_id', userId)
                .eq('subject_id', subjectId)
                .eq('semester', semester)
                .order('index')
                .then(({ data }) => {
                    setTopics(data || []);
                });

            // Fetch teacher materials
            supabase
                .from('teacher_materials')
                .select('*, teacher:profiles(*)')
                .eq('subject_id', subjectId)
                .eq('semester', semester)
                .order('created_at', { ascending: false })
                .then(({ data }) => {
                    setTeacherMaterials(data || []);
                    setLoading(false);
                });
        }
    }, [isOpen, userId, subjectId, semester]);

    const handleAddTopic = async () => {
        const newIndex = topics.length;
        const { data } = await supabase
            .from('topics')
            .insert({
                owner_id: userId,
                subject_id: subjectId,
                semester,
                title: `Thema ${newIndex + 1}`,
                index: newIndex,
            })
            .select()
            .single();

        if (data) {
            setTopics([...topics, data]);
        }
    };

    return (
        <div className="mb-4 rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-white">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "w-full flex items-center justify-between p-6 text-left transition-colors duration-200",
                    isOpen ? "bg-gray-50" : "bg-white hover:bg-gray-50"
                )}
            >
                <div className="flex items-center gap-4">
                    <div className={cn("w-2 h-8 rounded-full", colorClass)}></div>
                    <span className="text-xl font-semibold text-gray-900">{semester}</span>
                </div>
                {isOpen ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
            </button>

            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial="collapsed"
                        animate="open"
                        exit="collapsed"
                        variants={{
                            open: { opacity: 1, height: "auto" },
                            collapsed: { opacity: 0, height: 0 }
                        }}
                        transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                    >
                        <div className="px-6 pb-6 pt-2 bg-gray-50">
                            {loading ? (
                                <div className="p-4 text-center text-gray-400 text-sm">Laden...</div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Student Notes Column */}
                                    <div>
                                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <FileText size={14} />
                                            Mitschriften
                                        </h4>
                                        <div className="space-y-2">
                                            {topics.length === 0 ? (
                                                <div className="p-4 text-center text-gray-400 text-sm bg-white rounded-xl border border-gray-100">Keine Themen vorhanden.</div>
                                            ) : (
                                                topics.map((topic) => (
                                                    <Link
                                                        key={topic.id}
                                                        href={`/topic?subjectId=${subjectId}&semester=${semester}&id=${topic.id}`}
                                                        className="block p-4 rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center gap-3"
                                                    >
                                                        <div className="p-2 rounded-lg bg-blue-50 text-blue-500">
                                                            <FileText size={18} />
                                                        </div>
                                                        <span className="font-medium text-gray-800">{topic.title}</span>
                                                    </Link>
                                                ))
                                            )}
                                            {isOwner && (
                                                <button
                                                    onClick={handleAddTopic}
                                                    className="w-full p-4 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:text-blue-500 hover:border-blue-200 transition-colors flex items-center justify-center gap-2 group"
                                                >
                                                    <div className="p-1 rounded-full bg-gray-100 group-hover:bg-blue-50 text-inherit transition-colors">
                                                        <Plus size={16} />
                                                    </div>
                                                    <span className="font-medium">Thema hinzufügen</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Teacher Materials Column */}
                                    <div>
                                        <h4 className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <GraduationCap size={14} />
                                            Schulinhalte
                                        </h4>
                                        <div className="space-y-2">
                                            {teacherMaterials.length === 0 ? (
                                                <div className="p-4 text-center text-gray-400 text-sm bg-amber-50/50 rounded-xl border border-amber-100">Noch keine Inhalte vom Lehrer.</div>
                                            ) : (
                                                teacherMaterials.map((mat) => (
                                                    <Link
                                                        key={mat.id}
                                                        href={`/topic?subjectId=${subjectId}&semester=${semester}&teacherMaterial=${mat.id}`}
                                                        className="block p-4 rounded-xl bg-amber-50 border border-amber-100 shadow-sm hover:shadow-md transition-all"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
                                                                <FileText size={18} />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-medium text-gray-800 truncate">{mat.file_name}</p>
                                                                <p className="text-xs text-amber-600">{mat.teacher?.full_name}</p>
                                                            </div>
                                                        </div>
                                                    </Link>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function SubjectContent() {
    const searchParams = useSearchParams();
    const id = searchParams.get('id');
    const { user } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const subject = SUBJECTS.find((s) => s.id === id);
    const colorClass = "bg-blue-500"; // Default color

    if (!subject) return <div className="p-10 text-center">Subject not found</div>;

    return (
        <div className="flex min-h-screen bg-white">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
            <div className="flex-1 flex flex-col min-w-0">
                <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200">
                    <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Link href="/dashboard" className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
                                <ChevronLeft className="w-6 h-6 text-gray-600" />
                            </Link>
                            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900">{subject.name}</h1>
                        </div>
                        {/* Mobile Burger Menu Inline */}
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="md:hidden p-2 bg-white border border-gray-100 shadow-sm rounded-xl text-gray-900 active:scale-95"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                        </button>
                    </div>
                </div>

                <div className="max-w-3xl mx-auto px-6 py-8 w-full">
                    <div className="space-y-4">
                        {SEMESTERS.map((semester) => (
                            <SemesterAccordion
                                key={semester}
                                semester={semester}
                                subjectId={subject.id}
                                colorClass={colorClass}
                                userId={user?.id || ''}
                                isOwner={true}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function SubjectPage() {
    return (
        <Suspense fallback={<div className="p-10">Loading...</div>}>
            <SubjectContent />
        </Suspense>
    );
}
