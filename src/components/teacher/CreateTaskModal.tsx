'use client';

import { useState } from 'react';
import { X, Plus, Calendar, Book, Users, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { sendNotification } from '@/lib/notifications';

interface CreateTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

// Use shared constants
import { SUBJECTS } from '@/lib/constants';
/* 
const SUBJECT_OPTIONS = [ ... ] // Removed local definition
*/

export function CreateTaskModal({ isOpen, onClose, onSuccess }: CreateTaskModalProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [subjectId, setSubjectId] = useState('');
    const [courseType, setCourseType] = useState<string | null>(null);
    const [gradeLevel, setGradeLevel] = useState<string | null>(null);
    const [dueDate, setDueDate] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !title.trim() || !subjectId) return;

        setLoading(true);
        setError(null);

        try {
            const { error: insertError } = await supabase
                .from('teacher_tasks')
                .insert({
                    teacher_id: user.id,
                    title: title.trim(),
                    description: description.trim() || null,
                    subject_id: subjectId,
                    course_type: courseType,
                    grade_level: gradeLevel,
                    due_date: dueDate || null,
                });

            if (insertError) throw insertError;

            // Reset form
            setTitle('');
            setDescription('');
            setSubjectId('');
            setCourseType(null);
            setGradeLevel(null);
            setDueDate('');

            // Notify Students
            // We target based on subject_id and filters (courseType, gradeLevel)
            const subjectName = SUBJECTS.find(s => s.id === subjectId)?.name || 'Einem Fach';

            sendNotification(
                {
                    subjectId,
                    courseType: courseType || undefined,
                    gradeLevel: gradeLevel || undefined
                },
                `Neue Aufgabe in ${subjectName}`,
                `${title} (bis ${dueDate ? new Date(dueDate).toLocaleDateString('de-DE') : 'demnächst'})`
            );

            onSuccess?.();
            onClose();
        } catch (err: any) {
            console.error('[CreateTaskModal] Error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
                    onClick={(e) => e.target === e.currentTarget && onClose()}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
                    >
                        <form onSubmit={handleSubmit}>
                            {/* Header */}
                            <div className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Plus size={20} />
                                    <h2 className="font-bold">Neue Aufgabe erstellen</h2>
                                </div>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Form */}
                            <div className="p-5 space-y-4">
                                {error && (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                                        {error}
                                    </div>
                                )}

                                {/* Title */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Titel *
                                    </label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="z.B. Seite 42-45 lesen"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                                        required
                                    />
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Beschreibung (optional)
                                    </label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Weitere Details zur Aufgabe..."
                                        rows={2}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 resize-none"
                                    />
                                </div>

                                {/* Subject */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        <Book size={14} className="inline mr-1" />
                                        Fach *
                                    </label>
                                    <select
                                        value={subjectId}
                                        onChange={(e) => setSubjectId(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                                        required
                                    >
                                        <option value="">Fach auswählen...</option>
                                        {SUBJECTS.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Filters Row */}
                                <div className="grid grid-cols-2 gap-3">
                                    {/* Course Type */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            <Users size={14} className="inline mr-1" />
                                            Kursart
                                        </label>
                                        <select
                                            value={courseType || ''}
                                            onChange={(e) => setCourseType(e.target.value || null)}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                                        >
                                            <option value="">Alle</option>
                                            <option value="LK">Leistungskurs (LK)</option>
                                            <option value="GK">Grundkurs (GK)</option>
                                            <option value="M">Mündlich (M)</option>
                                            <option value="A">Anrechnung (A)</option>
                                        </select>
                                    </div>

                                    {/* Grade Level */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Klassenstufe
                                        </label>
                                        <select
                                            value={gradeLevel || ''}
                                            onChange={(e) => setGradeLevel(e.target.value || null)}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                                        >
                                            <option value="">Alle</option>
                                            <option value="12">12. Klasse (Q1/Q2)</option>
                                            <option value="13">13. Klasse (Q3/Q4)</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Due Date */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        <Calendar size={14} className="inline mr-1" />
                                        Fälligkeitsdatum (optional)
                                    </label>
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        min={new Date().toISOString().split('T')[0]}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                                >
                                    Abbrechen
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || !title.trim() || !subjectId}
                                    className={cn(
                                        "px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium",
                                        "hover:shadow-lg hover:shadow-indigo-500/30 transition-all",
                                        "disabled:opacity-50 disabled:cursor-not-allowed"
                                    )}
                                >
                                    {loading ? 'Erstelle...' : 'Aufgabe erstellen'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default CreateTaskModal;
