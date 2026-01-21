'use client';

import { useState } from 'react';
import { X, BookOpen, Search } from 'lucide-react';
import { SUBJECTS } from '@/lib/constants';
import { supabase } from '@/lib/supabase/client';

interface MaterialRequestModalProps {
    friend: any;
    currentUser: any;
    onClose: () => void;
    onSent: () => void;
}

export function MaterialRequestModal({ friend, currentUser, onClose, onSent }: MaterialRequestModalProps) {
    const [selectedSubject, setSelectedSubject] = useState('');
    const [topic, setTopic] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSubject || !topic) return;

        setLoading(true);
        const subjectName = SUBJECTS.find(s => s.id === selectedSubject)?.name || selectedSubject;

        const { error } = await supabase
            .from('messages')
            .insert([
                {
                    sender_id: currentUser.id,
                    receiver_id: friend.id,
                    content: `Könntest du mir Material zu ${subjectName} schicken?`,
                    message_type: 'material_request',
                    metadata: {
                        subject: subjectName,
                        topic: topic
                    }
                }
            ]);

        if (!error) {
            onSent();
            onClose();
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                            <BookOpen size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Material anfragen</h2>
                            <p className="text-xs text-gray-500">Frage {friend.full_name} nach Unterlagen</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fach auswählen</label>
                        <select
                            value={selectedSubject}
                            onChange={(e) => setSelectedSubject(e.target.value)}
                            required
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        >
                            <option value="">Wähle ein Fach...</option>
                            {SUBJECTS.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Was genau suchst du?</label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="z.B. Q1 Zusammenfassung, Übungsaufgaben..."
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                required
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                            />
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                        </div>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading || !selectedSubject || !topic}
                            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-100"
                        >
                            {loading ? "Wird gesendet..." : "Anfrage senden"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
