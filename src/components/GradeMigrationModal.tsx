'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Profile } from '@/lib/types';
import { Loader2 } from 'lucide-react';

interface GradeMigrationModalProps {
    user: Profile;
    onUpdate: (newGrade: string) => void;
}

export function GradeMigrationModal({ user, onUpdate }: GradeMigrationModalProps) {
    const [loading, setLoading] = useState(false);

    // Only show if user is loaded but has no grade_level
    // We handle the "if" logic in the parent usually, but good to be safe.
    if (user.grade_level) return null;

    const handleSelect = async (grade: string) => {
        setLoading(true);
        const { error } = await supabase
            .from('profiles')
            .update({ grade_level: grade })
            .eq('id', user.id);

        if (!error) {
            onUpdate(grade);
        } else {
            console.error(error);
            alert("Fehler beim Speichern. Bitte versuche es erneut.");
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-2xl text-center space-y-6">
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-gray-900">Willkommen zurück!</h2>
                    <p className="text-gray-600">
                        Um dir die passenden Inhalte (wie Alt-Klausuren) anzuzeigen, müssen wir wissen, in welcher Stufe du bist.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => handleSelect('12')}
                        disabled={loading}
                        className="p-6 rounded-xl border-2 border-blue-100 hover:border-blue-500 hover:bg-blue-50 transition-all font-bold text-lg text-blue-700 flex flex-col items-center gap-2"
                    >
                        <span className="text-3xl">12</span>
                        <span>Klasse 12</span>
                    </button>
                    <button
                        onClick={() => handleSelect('13')}
                        disabled={loading}
                        className="p-6 rounded-xl border-2 border-purple-100 hover:border-purple-500 hover:bg-purple-50 transition-all font-bold text-lg text-purple-700 flex flex-col items-center gap-2"
                    >
                        <span className="text-3xl">13</span>
                        <span>Klasse 13</span>
                    </button>
                </div>

                {loading && <p className="text-sm text-gray-400 flex items-center justify-center gap-2"><Loader2 className="animate-spin w-4 h-4" /> Speichere...</p>}
            </div>
        </div>
    );
}
