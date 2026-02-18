'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SUBJECTS } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { TeacherMaterial } from '@/lib/types';
import { Upload, BookOpen, FileText, ChevronRight, GraduationCap, Calendar, FileStack, ClipboardList, Plus, Trash2 } from 'lucide-react';
import { cn, formatGrade } from '@/lib/utils';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { CreateTaskModal } from '@/components/teacher/CreateTaskModal';

export default function TeacherDashboardPage() {
    const { user, profile } = useAuth();
    const [teacherSubjects, setTeacherSubjects] = useState<string[]>([]);
    const [recentUploads, setRecentUploads] = useState<TeacherMaterial[]>([]);
    const [teacherTasks, setTeacherTasks] = useState<any[]>([]);

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            if (!user) return;

            // Fetch teacher's subjects
            const { data: userSubjects } = await supabase
                .from('user_subjects')
                .select('subject_id')
                .eq('user_id', user.id);

            if (userSubjects) {
                setTeacherSubjects(userSubjects.map(s => s.subject_id));
            }

            // Fetch recent uploads
            const { data: uploads } = await supabase
                .from('teacher_materials')
                .select('*')
                .eq('teacher_id', user.id)
                .order('created_at', { ascending: false })
                .limit(10);

            if (uploads) {
                setRecentUploads(uploads);
            }

            // Fetch teacher's created tasks
            const { data: tasks } = await supabase
                .from('teacher_tasks')
                .select('*')
                .eq('teacher_id', user.id)
                .order('created_at', { ascending: false });

            if (tasks) {
                setTeacherTasks(tasks);
            }



            setLoading(false);
        }
        loadData();
    }, [user, profile]);



    // Redirect non-teachers
    if (profile && profile.role !== 'teacher' && profile.role !== 'admin') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center p-8 bg-white rounded-2xl shadow-lg">
                    <GraduationCap size={48} className="mx-auto mb-4 text-gray-400" />
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Kein Lehrer-Zugang</h2>
                    <p className="text-gray-500 mb-4">Diese Seite ist nur für Lehrer zugänglich.</p>
                    <Link href="/dashboard" className="text-blue-600 font-medium hover:underline">
                        Zurück zum Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    const displayedSubjects = SUBJECTS.filter(s => teacherSubjects.includes(s.id));

    return (
        <div className="flex min-h-screen bg-gray-50">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
            <div className="flex-1 flex flex-col min-w-0">
                <main className="flex-1 p-4 md:p-8">
                    <div className="max-w-5xl mx-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">Lehrer-Dashboard</h1>
                                <p className="text-gray-500 text-sm mt-1">Willkommen, {profile?.full_name}!</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Link
                                    href="/teacher/upload"
                                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all active:scale-95"
                                >
                                    <Upload size={18} />
                                    <span className="hidden sm:inline">Hochladen</span>
                                </Link>
                                <button
                                    onClick={() => setIsSidebarOpen(true)}
                                    className="md:hidden p-2 bg-white border border-gray-100 shadow-sm rounded-xl text-gray-900 active:scale-95"
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                                </button>
                            </div>
                        </div>

                        {/* Quick Access */}
                        <section className="mb-10">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">Schnellzugriff</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Link
                                    href="/materials"
                                    className="group bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center gap-4"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                                        <Calendar size={24} />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-gray-900 group-hover:text-amber-600 transition-colors">Unterrichtsmaterial</h3>
                                        <p className="text-sm text-gray-500">Kalender & Wochenplan</p>
                                    </div>
                                    <ChevronRight size={20} className="text-gray-300 group-hover:text-amber-500 transition-colors" />
                                </Link>

                                <Link
                                    href="/exams"
                                    className="group bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center gap-4"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                                        <FileStack size={24} />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-gray-900 group-hover:text-purple-600 transition-colors">Altklausuren</h3>
                                        <p className="text-sm text-gray-500">Üben & Vorbereiten</p>
                                    </div>
                                    <ChevronRight size={20} className="text-gray-300 group-hover:text-purple-500 transition-colors" />
                                </Link>
                            </div>
                        </section>

                        {/* Registration Requests */}




                        {/* My Subjects */}
                        <section className="mb-10">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-gray-900">Meine Fächer</h2>
                                <Link href="/subjects/selection" className="text-sm text-blue-600 font-medium hover:underline">
                                    Bearbeiten
                                </Link>
                            </div>
                            {loading ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
                                    ))}
                                </div>
                            ) : displayedSubjects.length === 0 ? (
                                <div className="bg-white p-8 rounded-2xl border border-gray-100 text-center">
                                    <BookOpen size={32} className="mx-auto mb-3 text-gray-300" />
                                    <p className="text-gray-500 mb-4">Keine Fächer ausgewählt.</p>
                                    <Link href="/subjects/selection" className="text-blue-600 font-medium hover:underline">
                                        Fächer auswählen
                                    </Link>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {displayedSubjects.map(subject => (
                                        <Link
                                            key={subject.id}
                                            href={`/teacher/upload?subject=${subject.id}`}
                                            className="group bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between"
                                        >
                                            <div>
                                                <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                                                    {subject.name}
                                                </h3>
                                                <p className="text-xs text-gray-400 mt-1">Material hochladen</p>
                                            </div>
                                            <ChevronRight size={20} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </section>

                        {/* Recent Uploads */}
                        <section>
                            <h2 className="text-lg font-bold text-gray-900 mb-4">Zuletzt hochgeladen</h2>
                            {recentUploads.length === 0 ? (
                                <div className="bg-white p-8 rounded-2xl border border-gray-100 text-center">
                                    <FileText size={32} className="mx-auto mb-3 text-gray-300" />
                                    <p className="text-gray-500">Noch keine Materialien hochgeladen.</p>
                                </div>
                            ) : (
                                <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                                    {recentUploads.map(material => {
                                        const subject = SUBJECTS.find(s => s.id === material.subject_id);
                                        return (
                                            <Link
                                                key={material.id}
                                                href={`/topic?teacherMaterial=${material.id}&subjectId=${material.subject_id}&semester=${material.semester || ''}`}
                                                className="p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors group"
                                            >
                                                <div className="p-2 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
                                                    <FileText size={20} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">{material.file_name}</p>
                                                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                                                        <span className="bg-gray-100 px-1.5 py-0.5 rounded font-bold">
                                                            {subject?.name.substring(0, 3).toUpperCase()}
                                                        </span>
                                                        <span>{material.semester}</span>
                                                        <span>•</span>
                                                        <span>Jg. {formatGrade(material.grade_level)}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs text-gray-400">
                                                        {new Date(material.created_at).toLocaleDateString('de-DE')}
                                                    </span>
                                                    <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    </div>

                    {/* Create Task Modal */}
                    <CreateTaskModal
                        isOpen={isCreateTaskOpen}
                        onClose={() => setIsCreateTaskOpen(false)}
                        onSuccess={() => {
                            supabase
                                .from('teacher_tasks')
                                .select('*')
                                .eq('teacher_id', user!.id)
                                .order('created_at', { ascending: false })
                                .then(({ data }) => {
                                    if (data) setTeacherTasks(data);
                                });
                        }}
                    />
                </main>
            </div>
        </div>
    );
}
