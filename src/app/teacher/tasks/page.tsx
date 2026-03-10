'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { CreateTaskModal } from '@/components/teacher/CreateTaskModal';
import {
    ClipboardList,
    Plus,
    Search,
    Filter,
    Calendar,
    CheckCircle2,
    Clock,
    MoreVertical,
    Trash2,
    Eye,
    ArrowUpRight,
    Users,
    ChevronLeft
} from 'lucide-react';
import { cn, formatGrade } from '@/lib/utils';
import { SUBJECTS } from '@/lib/constants';

interface TaskStat {
    total: number;
    completed: number;
    seen: number;
}

interface EnrichedTask {
    id: string;
    title: string;
    description: string | null;
    subject_id: string;
    grade_level: string | null;
    course_type: string | null;
    due_date: string | null;
    created_at: string;
    stats?: TaskStat;
}

export default function TeacherTasksPage() {
    const { user, profile } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
    const [tasks, setTasks] = useState<EnrichedTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterSubject, setFilterSubject] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (!user || profile?.role !== 'teacher') return;

        const fetchTasks = async () => {
            setLoading(true);
            try {
                // 1. Fetch teacher's tasks
                const { data: myTasks, error: tasksError } = await supabase
                    .from('teacher_tasks')
                    .select('*')
                    .eq('teacher_id', user.id)
                    .order('created_at', { ascending: false });

                if (tasksError) throw tasksError;

                if (!myTasks || myTasks.length === 0) {
                    setTasks([]);
                    setLoading(false);
                    return;
                }

                // 2. Fetch stats for these tasks
                const taskIds = myTasks.map(t => t.id);
                const { data: statusData, error: statusError } = await supabase
                    .from('student_task_status')
                    .select('task_id, is_completed, seen_at')
                    .in('task_id', taskIds);

                if (statusError) throw statusError;

                // 3. Aggregate stats
                const statsMap = new Map<string, TaskStat>();
                statusData?.forEach(status => {
                    const current = statsMap.get(status.task_id) || { total: 0, completed: 0, seen: 0 };
                    // Note: "total" here is just interaction count, not total students. 
                    // Real "total students" is hard to get without course rosters.
                    // We'll just track interactions we know about.
                    if (status.is_completed) current.completed++;
                    if (status.seen_at) current.seen++;
                    statsMap.set(status.task_id, current);
                });

                const enriched: EnrichedTask[] = myTasks.map(t => ({
                    ...t,
                    stats: statsMap.get(t.id) || { total: 0, completed: 0, seen: 0 }
                }));

                setTasks(enriched);

            } catch (error) {
                console.error('Error fetching tasks:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchTasks();
    }, [user, profile]);

    const handleDelete = async (taskId: string) => {
        if (!confirm('Möchtest du diese Aufgabe wirklich löschen?')) return;

        try {
            await supabase.from('teacher_tasks').delete().eq('id', taskId);
            setTasks(prev => prev.filter(t => t.id !== taskId));
        } catch (error) {
            console.error('Error deleting task:', error);
            alert('Fehler beim Löschen');
        }
    };

    const filteredTasks = tasks.filter(t => {
        const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSubject = filterSubject === 'all' || t.subject_id === filterSubject;
        return matchesSearch && matchesSubject;
    });

    const stats = {
        total: tasks.length,
        active: tasks.length, // Logic for "active" could be based on due date
        completionRate: 0 // Placeholder
    };

    if (loading) {
        return (
            <div className="flex min-h-screen bg-gray-50 items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-gray-50">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            <div className="flex-1 flex flex-col min-w-0">
                <main className="flex-1 p-4 md:p-8">
                    <div className="max-w-6xl mx-auto space-y-8">

                        {/* Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <Link href="/teacher/dashboard" className="p-2 -ml-2 rounded-full hover:bg-gray-200 transition-colors">
                                    <ChevronLeft className="w-6 h-6 text-gray-600" />
                                </Link>
                                <div>
                                    <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
                                        <ClipboardList className="text-blue-600" size={32} />
                                        Aufgaben-Übersicht
                                    </h1>
                                    <p className="text-gray-500 mt-1">Verwalte deine Aufgaben und sieh den Fortschritt deiner Schüler.</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setIsSidebarOpen(true)}
                                    className="md:hidden p-2 bg-white border border-gray-100 rounded-xl"
                                >
                                    <Filter size={20} />
                                </button>
                                <button
                                    onClick={() => setIsCreateTaskOpen(true)}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
                                >
                                    <Plus size={20} />
                                    Neue Aufgabe
                                </button>
                            </div>
                        </div>

                        {/* Stats Row */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                <div className="flex items-center gap-3 text-gray-500 mb-1">
                                    <ClipboardList size={18} />
                                    <span className="text-sm font-medium">Gesamt</span>
                                </div>
                                <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
                            </div>
                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                <div className="flex items-center gap-3 text-green-600 mb-1">
                                    <CheckCircle2 size={18} />
                                    <span className="text-sm font-medium">Abgegeben (Total)</span>
                                </div>
                                <div className="text-3xl font-bold text-gray-900">
                                    {tasks.reduce((sum, t) => sum + (t.stats?.completed || 0), 0)}
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                <div className="flex items-center gap-3 text-blue-600 mb-1">
                                    <Eye size={18} />
                                    <span className="text-sm font-medium">Gesehen (Total)</span>
                                </div>
                                <div className="text-3xl font-bold text-gray-900">
                                    {tasks.reduce((sum, t) => sum + (t.stats?.seen || 0), 0)}
                                </div>
                            </div>
                        </div>

                        {/* Filters & Search */}
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Aufgaben suchen..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                />
                            </div>
                            <select
                                value={filterSubject}
                                onChange={(e) => setFilterSubject(e.target.value)}
                                className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[200px]"
                            >
                                <option value="all">Alle Fächer</option>
                                {SUBJECTS.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Tasks Table */}
                        {/* Tasks Grouped by Grade */}
                        {['13', '12', 'null'].map(grade => {
                            const gradeTasks = filteredTasks.filter(t =>
                                grade === 'null' ? !t.grade_level : t.grade_level === grade
                            );

                            if (gradeTasks.length === 0) return null;

                            return (
                                <div key={grade} className="space-y-4">
                                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                        <Users size={20} className="text-gray-400" />
                                        {grade === 'null' ? 'Sonstige / Keine Stufe' : `Klasse ${grade}`}
                                        <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                            {gradeTasks.length}
                                        </span>
                                    </h3>

                                    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead className="bg-gray-50 border-b border-gray-100">
                                                    <tr>
                                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-1/3">Aufgabe</th>
                                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Fach / Kurs</th>
                                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Fällig am</th>
                                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Aktionen</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {gradeTasks.map(task => {
                                                        const subject = SUBJECTS.find(s => s.id === task.subject_id);
                                                        const isOverdue = task.due_date && new Date(task.due_date) < new Date();

                                                        return (
                                                            <tr key={task.id} className="group hover:bg-gray-50 transition-colors">
                                                                <td className="px-6 py-4">
                                                                    <div className="font-bold text-gray-900">{task.title}</div>
                                                                    {task.description && (
                                                                        <div className="text-xs text-gray-500 mt-1 line-clamp-1 max-w-xs">{task.description}</div>
                                                                    )}
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <span className="px-2 py-1 bg-gray-100 rounded text-xs font-bold text-gray-600">
                                                                            {subject?.name || task.subject_id}
                                                                        </span>
                                                                        {task.course_type && (
                                                                            <span className={cn(
                                                                                "px-2 py-1 rounded text-xs font-bold",
                                                                                task.course_type.toUpperCase() === 'LK' ? "bg-amber-100 text-amber-700" :
                                                                                    task.course_type.toUpperCase() === 'GK' ? "bg-blue-100 text-blue-700" :
                                                                                        task.course_type.toUpperCase() === 'M' ? "bg-purple-100 text-purple-700" :
                                                                                            task.course_type.toUpperCase() === 'A' ? "bg-emerald-100 text-emerald-700" :
                                                                                                "bg-gray-100 text-gray-700"
                                                                            )}>
                                                                                {task.course_type.toUpperCase() === 'M' ? 'Mündlich' :
                                                                                    task.course_type.toUpperCase() === 'A' ? 'Anrechnung' :
                                                                                        task.course_type}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    {task.due_date ? (
                                                                        <div className={cn("flex items-center gap-1.5 text-sm", isOverdue ? "text-red-600 font-medium" : "text-gray-600")}>
                                                                            <Calendar size={14} />
                                                                            {new Date(task.due_date).toLocaleDateString('de-DE')}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-gray-400 text-sm">-</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="flex items-center gap-4 text-sm">
                                                                        <div className="flex items-center gap-1.5 text-green-600" title="Abgeschlossen">
                                                                            <CheckCircle2 size={16} />
                                                                            <span className="font-medium">{task.stats?.completed || 0}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1.5 text-blue-600" title="Gesehen">
                                                                            <Eye size={16} />
                                                                            <span className="font-medium">{task.stats?.seen || 0}</span>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 text-right">
                                                                    <button
                                                                        onClick={() => handleDelete(task.id)}
                                                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                        title="Löschen"
                                                                    >
                                                                        <Trash2 size={18} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {filteredTasks.length === 0 && (
                            <div className="bg-white p-12 rounded-2xl border border-gray-100 text-center">
                                <ClipboardList size={48} className="mx-auto mb-3 opacity-20 text-gray-400" />
                                <p className="text-gray-500">Keine Aufgaben gefunden</p>
                            </div>
                        )}

                    </div>
                </main>
            </div >

            <CreateTaskModal
                isOpen={isCreateTaskOpen}
                onClose={() => setIsCreateTaskOpen(false)}
                onSuccess={() => window.location.reload()}
            />
        </div >
    );
}
