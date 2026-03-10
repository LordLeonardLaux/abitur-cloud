'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { useTaskHub, TaskWithStatus } from '@/hooks/useTaskHub';
import { usePersonalTasks, PersonalTask } from '@/hooks/usePersonalTasks';
import { useAuth } from '@/contexts/AuthContext';
import {
    ClipboardList,
    Check,
    Clock,
    Calendar,
    GraduationCap,
    ChevronRight,
    Plus,
    Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TasksPage() {
    const { profile } = useAuth();
    const { tasks, loading, openCount, completedCount, markAsCompleted } = useTaskHub();
    const {
        personalTasks,
        loading: personalLoading,
        openCount: personalOpenCount,
        completedCount: personalCompletedCount,
        addTask: addPersonalTask,
        markAsCompleted: markPersonalAsCompleted,
        deleteTask: deletePersonalTask
    } = usePersonalTasks();

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [taskMode, setTaskMode] = useState<'school' | 'personal'>('school');
    const [activeTab, setActiveTab] = useState<'open' | 'completed'>('open');
    const [selectedTask, setSelectedTask] = useState<TaskWithStatus | null>(null);
    const [selectedPersonalTask, setSelectedPersonalTask] = useState<PersonalTask | null>(null);

    // Create Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newDueDate, setNewDueDate] = useState('');

    const filteredTasks = tasks.filter(t =>
        activeTab === 'open' ? !t.isCompleted : t.isCompleted
    );

    const filteredPersonalTasks = personalTasks.filter(t =>
        activeTab === 'open' ? !t.is_completed : t.is_completed
    );

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return { text: 'Überfällig', urgent: true };
        if (diffDays === 0) return { text: 'Heute', urgent: true };
        if (diffDays === 1) return { text: 'Morgen', urgent: true };
        if (diffDays <= 7) return { text: `In ${diffDays} Tagen`, urgent: false };
        return { text: date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }), urgent: false };
    };

    return (
        <div className="flex min-h-screen bg-white">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
            <div className="flex-1 flex flex-col min-w-0">
                <main className="flex-1 p-4 md:p-8">
                    <div className="max-w-2xl mx-auto">
                        {/* Mode Toggle (School vs Personal) */}
                        <div className="flex bg-gray-100 rounded-xl p-1 mb-6 mt-2">
                            <button
                                onClick={() => setTaskMode('school')}
                                className={cn(
                                    "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
                                    taskMode === 'school' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                                )}
                            >
                                Schul-Aufgaben
                            </button>
                            <button
                                onClick={() => setTaskMode('personal')}
                                className={cn(
                                    "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
                                    taskMode === 'personal' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                                )}
                            >
                                Eigene To-Dos
                            </button>
                        </div>

                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">
                                    {taskMode === 'school' ? 'Schul-Aufgaben' : 'Eigene To-Dos'}
                                </h2>
                                <p className="text-sm text-gray-400 mt-1">
                                    {taskMode === 'school' ? openCount : personalOpenCount} offen · {taskMode === 'school' ? completedCount : personalCompletedCount} erledigt
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {taskMode === 'personal' && (
                                    <button
                                        onClick={() => setIsCreateModalOpen(true)}
                                        className="p-2 bg-blue-600 text-white rounded-xl shadow-sm hover:bg-blue-500 transition-colors active:scale-95"
                                    >
                                        <Plus size={24} strokeWidth={2.5} />
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsSidebarOpen(true)}
                                    className="md:hidden p-2 bg-white border border-gray-100 shadow-sm rounded-xl text-gray-900 active:scale-95"
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                                </button>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
                            <button
                                onClick={() => setActiveTab('open')}
                                className={cn(
                                    "flex-1 py-2.5 text-sm font-bold rounded-lg transition-all",
                                    activeTab === 'open'
                                        ? "bg-white text-gray-900 shadow-sm"
                                        : "text-gray-500"
                                )}
                            >
                                Offen ({taskMode === 'school' ? openCount : personalOpenCount})
                            </button>
                            <button
                                onClick={() => setActiveTab('completed')}
                                className={cn(
                                    "flex-1 py-2.5 text-sm font-bold rounded-lg transition-all",
                                    activeTab === 'completed'
                                        ? "bg-white text-gray-900 shadow-sm"
                                        : "text-gray-500"
                                )}
                            >
                                Erledigt ({taskMode === 'school' ? completedCount : personalCompletedCount})
                            </button>
                        </div>

                        {/* Task List */}
                        {(taskMode === 'school' ? loading : personalLoading) ? (
                            <div className="py-16 text-center text-gray-400">
                                <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full mx-auto mb-3" />
                                Lädt Aufgaben...
                            </div>
                        ) : (taskMode === 'school' ? filteredTasks : filteredPersonalTasks).length === 0 ? (
                            <div className="py-16 text-center text-gray-400">
                                <ClipboardList size={48} className="mx-auto mb-4 opacity-40" />
                                <p className="text-lg font-medium">
                                    {activeTab === 'open' ? 'Keine offenen Aufgaben 🎉' : 'Noch keine erledigten Aufgaben'}
                                </p>
                                <p className="text-sm mt-1">
                                    {activeTab === 'open' ? 'Alles erledigt!' : 'Schließe Aufgaben ab um sie hier zu sehen.'}
                                </p>
                            </div>
                        ) : taskMode === 'school' ? (
                            <div className="space-y-3">
                                {filteredTasks.map(task => {
                                    const dueInfo = formatDate(task.due_date);
                                    return (
                                        <div
                                            key={task.id}
                                            onClick={() => setSelectedTask(task)}
                                            className={cn(
                                                "bg-white border rounded-2xl p-4 transition-all active:scale-[0.98] cursor-pointer",
                                                task.isNew ? "border-blue-200 bg-blue-50/30" : "border-gray-100",
                                                task.isCompleted && "opacity-60"
                                            )}
                                        >
                                            <div className="flex items-start gap-3">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        markAsCompleted(task.id, !task.isCompleted);
                                                    }}
                                                    className={cn(
                                                        "shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all mt-0.5",
                                                        task.isCompleted
                                                            ? "bg-green-500 border-green-500 text-white"
                                                            : "border-gray-300 hover:border-blue-500"
                                                    )}
                                                >
                                                    {task.isCompleted && <Check size={14} />}
                                                </button>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <h3 className={cn(
                                                            "font-bold text-sm",
                                                            task.isCompleted ? "text-gray-400 line-through" : "text-gray-900"
                                                        )}>
                                                            {task.title}
                                                            {task.isNew && (
                                                                <span className="ml-2 px-1.5 py-0.5 bg-blue-500 text-white text-[9px] font-bold rounded uppercase">Neu</span>
                                                            )}
                                                        </h3>
                                                        <ChevronRight size={16} className="text-gray-300 shrink-0 mt-0.5" />
                                                    </div>

                                                    {task.description && (
                                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
                                                    )}

                                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                        <span className="text-[10px] font-bold uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                                            {task.subject_id}
                                                        </span>
                                                        {task.course_type && (
                                                            <span className="text-[10px] text-gray-400 font-medium">
                                                                {task.course_type.toUpperCase() === 'M' ? 'Mündlich' :
                                                                    task.course_type.toUpperCase() === 'A' ? 'Anrechnung' :
                                                                        task.course_type.toUpperCase()}
                                                            </span>
                                                        )}
                                                        {dueInfo && (
                                                            <span className={cn(
                                                                "flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full",
                                                                dueInfo.urgent
                                                                    ? "bg-red-50 text-red-600"
                                                                    : "bg-gray-50 text-gray-500"
                                                            )}>
                                                                <Clock size={10} />
                                                                {dueInfo.text}
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] text-gray-400">
                                                            von {task.teacher?.full_name || 'Lehrer'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {filteredPersonalTasks.map(task => {
                                    const dueInfo = formatDate(task.due_date);
                                    return (
                                        <div
                                            key={task.id}
                                            onClick={() => setSelectedPersonalTask(task)}
                                            className={cn(
                                                "bg-white border rounded-2xl p-4 transition-all active:scale-[0.98] cursor-pointer",
                                                task.is_completed ? "opacity-60 border-gray-100" : "border-gray-100"
                                            )}
                                        >
                                            <div className="flex items-start gap-3">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        markPersonalAsCompleted(task.id, !task.is_completed);
                                                    }}
                                                    className={cn(
                                                        "shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all mt-0.5",
                                                        task.is_completed
                                                            ? "bg-green-500 border-green-500 text-white"
                                                            : "border-gray-300 hover:border-blue-500"
                                                    )}
                                                >
                                                    {task.is_completed && <Check size={14} />}
                                                </button>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <h3 className={cn(
                                                            "font-bold text-sm",
                                                            task.is_completed ? "text-gray-400 line-through" : "text-gray-900"
                                                        )}>
                                                            {task.title}
                                                        </h3>
                                                        <ChevronRight size={16} className="text-gray-300 shrink-0 mt-0.5" />
                                                    </div>

                                                    {task.description && (
                                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
                                                    )}

                                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                        {dueInfo && (
                                                            <span className={cn(
                                                                "flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full",
                                                                dueInfo.urgent
                                                                    ? "bg-red-50 text-red-600"
                                                                    : "bg-gray-50 text-gray-500"
                                                            )}>
                                                                <Clock size={10} />
                                                                {dueInfo.text}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {/* Task Detail Modal */}
            {selectedTask && (
                <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center">
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedTask(null)} />
                    <div className="relative w-full max-w-lg bg-white rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden max-h-[80vh]">
                        <div className="p-6 bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
                            <div className="flex justify-between items-start">
                                <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold uppercase tracking-wider">
                                    {selectedTask.subject_id}
                                </span>
                                <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-white/10 rounded-full">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>
                            <h2 className="text-xl font-bold mt-4">{selectedTask.title}</h2>
                            <div className="flex items-center gap-4 mt-3 text-sm text-blue-100">
                                {selectedTask.due_date && (
                                    <div className="flex items-center gap-1.5">
                                        <Calendar size={14} />
                                        <span>Bis: {formatDate(selectedTask.due_date)?.text}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-1.5">
                                    <GraduationCap size={14} />
                                    <span>{selectedTask.teacher?.full_name}</span>
                                </div>
                            </div>
                        </div>
                        <div className="p-6">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Beschreibung</h3>
                            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                                {selectedTask.description || "Keine Beschreibung vorhanden."}
                            </p>
                            <button
                                onClick={() => {
                                    markAsCompleted(selectedTask.id, !selectedTask.isCompleted);
                                    setSelectedTask(null);
                                }}
                                className={cn(
                                    "w-full mt-8 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold transition-all active:scale-95",
                                    selectedTask.isCompleted
                                        ? "bg-gray-100 text-gray-600"
                                        : "bg-green-500 text-white shadow-lg shadow-green-200"
                                )}
                            >
                                <Check size={20} />
                                {selectedTask.isCompleted ? 'Als offen markieren' : 'Abgeschlossen'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Personal Task Detail Modal */}
            {selectedPersonalTask && (
                <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center">
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedPersonalTask(null)} />
                    <div className="relative w-full max-w-lg bg-white rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden max-h-[80vh]">
                        <div className="p-6 bg-gradient-to-br from-indigo-500 to-blue-600 text-white">
                            <div className="flex justify-between items-start">
                                <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold uppercase tracking-wider">
                                    Eigenes To-Do
                                </span>
                                <button onClick={() => setSelectedPersonalTask(null)} className="p-2 hover:bg-white/10 rounded-full">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>
                            <h2 className="text-xl font-bold mt-4">{selectedPersonalTask.title}</h2>
                            <div className="flex items-center gap-4 mt-3 text-sm text-blue-100">
                                {selectedPersonalTask.due_date && (
                                    <div className="flex items-center gap-1.5">
                                        <Calendar size={14} />
                                        <span>Bis: {formatDate(selectedPersonalTask.due_date)?.text}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-6 relative">
                            {/* Delete Button */}
                            <button
                                onClick={async () => {
                                    if (confirm('Möchtest du diese Aufgabe wirklich löschen?')) {
                                        await deletePersonalTask(selectedPersonalTask.id);
                                        setSelectedPersonalTask(null);
                                    }
                                }}
                                className="absolute top-4 right-4 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Aufgabe löschen"
                            >
                                <Trash2 size={20} />
                            </button>

                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Beschreibung</h3>
                            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                                {selectedPersonalTask.description || "Keine Beschreibung vorhanden."}
                            </p>
                            <button
                                onClick={() => {
                                    markPersonalAsCompleted(selectedPersonalTask.id, !selectedPersonalTask.is_completed);
                                    setSelectedPersonalTask(null);
                                }}
                                className={cn(
                                    "w-full mt-8 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold transition-all active:scale-95",
                                    selectedPersonalTask.is_completed
                                        ? "bg-gray-100 text-gray-600"
                                        : "bg-green-500 text-white shadow-lg shadow-green-200"
                                )}
                            >
                                <Check size={20} />
                                {selectedPersonalTask.is_completed ? 'Als offen markieren' : 'Abgeschlossen'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Personal Task Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)} />
                    <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
                        <div className="p-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex justify-between items-center">
                            <h2 className="font-bold text-lg flex items-center gap-2"><Plus size={20} /> Neues To-Do</h2>
                            <button onClick={() => setIsCreateModalOpen(false)} className="p-1 hover:bg-white/20 rounded-full">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();
                                if (!newTitle.trim()) return;
                                await addPersonalTask(newTitle, newDescription, newDueDate);
                                setNewTitle('');
                                setNewDescription('');
                                setNewDueDate('');
                                setIsCreateModalOpen(false);
                            }}
                            className="p-6 space-y-4"
                        >
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Titel *</label>
                                <input
                                    required
                                    type="text"
                                    value={newTitle}
                                    onChange={e => setNewTitle(e.target.value)}
                                    placeholder="z.B. Englisch Vokabeln lernen"
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Beschreibung (Optional)</label>
                                <textarea
                                    value={newDescription}
                                    onChange={e => setNewDescription(e.target.value)}
                                    placeholder="Unit 4 Vokabeln, Seite 142..."
                                    rows={3}
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Fälligkeitsdatum (Optional)</label>
                                <input
                                    type="date"
                                    value={newDueDate}
                                    onChange={e => setNewDueDate(e.target.value)}
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={!newTitle.trim()}
                                className="w-full mt-4 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-500 disabled:opacity-50 transition-colors"
                            >
                                Speichern
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
