'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardList, X, Check, Clock, AlertCircle, ChevronRight, Bell, GraduationCap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTaskHub, TaskWithStatus } from '@/hooks/useTaskHub';
import { cn } from '@/lib/utils';

interface TaskHubProps {
    className?: string;
}

export function TaskHub({ className }: TaskHubProps) {
    const { tasks, loading, openCount, completedCount, newCount, markAsSeen, markAsCompleted } = useTaskHub();
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'open' | 'completed'>('open');
    const [selectedTask, setSelectedTask] = useState<TaskWithStatus | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

    // Calculate dropdown position from trigger button
    const updatePosition = useCallback(() => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setDropdownPos({
                top: rect.bottom + 12,
                left: Math.max(8, rect.left), // At least 8px from the edge
            });
        }
    }, []);

    // Mark all visible tasks as seen when opening
    useEffect(() => {
        if (isOpen) {
            tasks.filter(t => t.isNew).forEach(t => markAsSeen(t.id));
            updatePosition();
        }
    }, [isOpen, tasks, markAsSeen, updatePosition]);

    // Update position on scroll/resize
    useEffect(() => {
        if (!isOpen) return;
        const handler = () => updatePosition();
        window.addEventListener('scroll', handler, true);
        window.addEventListener('resize', handler);
        return () => {
            window.removeEventListener('scroll', handler, true);
            window.removeEventListener('resize', handler);
        };
    }, [isOpen, updatePosition]);

    const filteredTasks = tasks.filter(t =>
        activeTab === 'open' ? !t.isCompleted : t.isCompleted
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

    // Portal-rendered dropdown content
    const dropdownContent = isOpen && typeof document !== 'undefined' ? createPortal(
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Full-screen backdrop */}
                    <div
                        className="fixed inset-0 z-[9998] cursor-default"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsOpen(false);
                        }}
                    />

                    {/* Dropdown panel – positioned via JS */}
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        style={{
                            position: 'fixed',
                            top: dropdownPos.top,
                            left: dropdownPos.left,
                            zIndex: 9999,
                        }}
                        className="w-[280px] sm:w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden origin-top-left"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Bell size={20} />
                                    <h3 className="font-bold">Aufgaben</h3>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-gray-100">
                            <button
                                onClick={() => setActiveTab('open')}
                                className={cn(
                                    "flex-1 py-3 text-sm font-medium transition-colors relative",
                                    activeTab === 'open'
                                        ? "text-blue-600"
                                        : "text-gray-500 hover:text-gray-700"
                                )}
                            >
                                Offen ({openCount})
                                {activeTab === 'open' && (
                                    <motion.div
                                        layoutId="taskhub-tab-indicator"
                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                                    />
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('completed')}
                                className={cn(
                                    "flex-1 py-3 text-sm font-medium transition-colors relative",
                                    activeTab === 'completed'
                                        ? "text-green-600"
                                        : "text-gray-500 hover:text-gray-700"
                                )}
                            >
                                Erledigt ({completedCount})
                                {activeTab === 'completed' && (
                                    <motion.div
                                        layoutId="taskhub-tab-indicator"
                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600"
                                    />
                                )}
                            </button>
                        </div>

                        {/* Task List */}
                        <div className="max-h-[400px] overflow-y-auto">
                            {loading ? (
                                <div className="p-8 text-center text-gray-400">
                                    <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full mx-auto mb-2" />
                                    Lädt...
                                </div>
                            ) : filteredTasks.length === 0 ? (
                                <div className="p-8 text-center text-gray-400">
                                    <ClipboardList size={32} className="mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">
                                        {activeTab === 'open'
                                            ? 'Keine offenen Aufgaben'
                                            : 'Keine erledigten Aufgaben'}
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50">
                                    {filteredTasks.map(task => (
                                        <TaskItem
                                            key={task.id}
                                            task={task}
                                            onToggleComplete={() => markAsCompleted(task.id, !task.isCompleted)}
                                            onViewDetails={() => setSelectedTask(task)}
                                            formatDate={formatDate}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>,
        document.body
    ) : null;

    // Portal-rendered detail modal
    const detailModal = selectedTask && typeof document !== 'undefined' ? createPortal(
        <AnimatePresence>
            {selectedTask && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={() => setSelectedTask(null)}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
                    >
                        <div className="p-6 bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
                            <div className="flex justify-between items-start">
                                <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-md">
                                    {selectedTask.subject_id}
                                </span>
                                <button
                                    onClick={() => setSelectedTask(null)}
                                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <h2 className="text-2xl font-bold mt-4">{selectedTask.title}</h2>
                            <div className="flex items-center gap-4 mt-4 text-sm text-blue-100">
                                <div className="flex items-center gap-1.5">
                                    <Clock size={16} />
                                    <span>Bis: {formatDate(selectedTask.due_date)?.text || 'Kein Datum'}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <GraduationCap size={16} />
                                    <span>{selectedTask.teacher?.full_name}</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-8">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Beschreibung</h3>
                            <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                                {selectedTask.description || "Keine Beschreibung vorhanden."}
                            </div>

                            <div className="mt-10 flex gap-3">
                                <button
                                    onClick={() => {
                                        markAsCompleted(selectedTask.id, !selectedTask.isCompleted);
                                        setSelectedTask(null);
                                    }}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold transition-all shadow-lg active:scale-95",
                                        selectedTask.isCompleted
                                            ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                            : "bg-green-500 text-white hover:bg-green-600 shadow-green-200"
                                    )}
                                >
                                    <Check size={20} />
                                    {selectedTask.isCompleted ? 'Als offen markieren' : 'Abgeschlossen'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    ) : null;

    return (
        <div className={cn("relative", className)}>
            {/* Trigger Button – stays in sidebar */}
            <button
                ref={triggerRef}
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className={cn(
                    "flex items-center gap-1.5 p-1.5 bg-white border border-gray-100 rounded-full shadow-sm hover:shadow-md transition-all active:scale-95",
                    isOpen && "ring-2 ring-blue-500/20"
                )}
                title="Aufgaben-Hub"
            >
                {/* Gray Point (Completed) */}
                <div className="flex items-center justify-center min-w-[26px] h-[26px] px-2 bg-gray-100 text-gray-500 rounded-full text-[11px] font-bold border border-gray-200/50">
                    {completedCount}
                </div>

                {/* Red Point (Open + NEW Badge) */}
                <div className={cn(
                    "flex items-center justify-center gap-1.5 h-[26px] text-white rounded-full text-[11px] font-bold transition-all duration-500",
                    newCount > 0
                        ? "bg-red-500 pl-2.5 pr-3 min-w-[50px] animate-pulse shadow-sm shadow-red-200"
                        : "bg-red-500 px-2 min-w-[26px]"
                )}>
                    <span>{newCount > 0 ? newCount : openCount}</span>
                    {newCount > 0 && <span className="text-[9px] uppercase tracking-wider opacity-90 font-extrabold">NEW</span>}
                </div>
            </button>

            {/* Portal-rendered dropdown + modal */}
            {dropdownContent}
            {detailModal}
        </div>
    );
}

interface TaskItemProps {
    task: TaskWithStatus;
    onToggleComplete: () => void;
    onViewDetails: () => void;
    formatDate: (date: string | null) => { text: string; urgent: boolean } | null;
}

function TaskItem({ task, onToggleComplete, onViewDetails, formatDate }: TaskItemProps) {
    const dueInfo = formatDate(task.due_date);

    return (
        <div
            className="p-4 hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-50 last:border-0"
            onClick={onViewDetails}
        >
            <div className="flex items-start gap-3">
                {/* Checkbox */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleComplete();
                    }}
                    className={cn(
                        "shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all mt-0.5",
                        task.isCompleted
                            ? "bg-green-500 border-green-500 text-white"
                            : "border-gray-300 hover:border-blue-500"
                    )}
                >
                    {task.isCompleted && <Check size={12} />}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <h4 className={cn(
                            "font-medium text-sm",
                            task.isCompleted ? "text-gray-400 line-through" : "text-gray-900"
                        )}>
                            {task.title}
                        </h4>
                        {dueInfo && (
                            <span className={cn(
                                "shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded",
                                dueInfo.urgent
                                    ? "bg-red-100 text-red-600"
                                    : "bg-gray-100 text-gray-500"
                            )}>
                                {dueInfo.text}
                            </span>
                        )}
                    </div>

                    {task.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                            {task.description}
                        </p>
                    )}

                    <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] font-bold uppercase text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                            {task.subject_id}
                        </span>
                        {task.course_type && (
                            <span className="text-[10px] text-gray-400">
                                {task.course_type}
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
}

export default TaskHub;
