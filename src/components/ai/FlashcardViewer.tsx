'use client';

import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Download, RotateCw, Save, Check, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { downloadFlashcardPdf, Flashcard } from '@/lib/flashcardPdfGenerator';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface FlashcardViewerProps {
    isOpen: boolean;
    onClose: () => void;
    flashcards: Flashcard[];
    title?: string;
    topicId?: string;
    materialId?: string;
}

export default function FlashcardViewer({ isOpen, onClose, flashcards, title, topicId, materialId }: FlashcardViewerProps) {
    const { user } = useAuth();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const currentCard = flashcards[currentIndex];

    const goNext = () => {
        if (currentIndex < flashcards.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setIsFlipped(false);
        }
    };

    const goPrevious = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            setIsFlipped(false);
        }
    };

    const handleDownloadPdf = () => {
        downloadFlashcardPdf(flashcards, { title: title || 'Karteikarten' });
    };

    const handleSave = async () => {
        if (!user || isSaving) return;

        setIsSaving(true);
        setSaveStatus('idle');

        try {
            const { error } = await supabase.from('flashcard_sets').insert({
                user_id: user.id,
                topic_id: topicId || null,
                material_id: materialId || null,
                title: title || 'Karteikarten',
                cards: flashcards,
            });

            if (error) throw error;
            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (err: any) {
            console.error('Flashcard save error:', err);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } finally {
            setIsSaving(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowRight') goNext();
        if (e.key === 'ArrowLeft') goPrevious();
        if (e.key === ' ') {
            e.preventDefault();
            setIsFlipped(!isFlipped);
        }
        if (e.key === 'Escape') onClose();
    };

    if (!isOpen || flashcards.length === 0) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/70 backdrop-blur-md z-[200] flex items-center justify-center p-4"
                    onKeyDown={handleKeyDown}
                    tabIndex={0}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-xl">
                                    <Sparkles size={20} />
                                </div>
                                <div>
                                    <h2 className="font-bold">{title || 'Karteikarten'}</h2>
                                    <p className="text-xs opacity-80">{flashcards.length} Karten zum Lernen</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Save Button */}
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving || saveStatus === 'success'}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all",
                                        saveStatus === 'success'
                                            ? "bg-green-500/30 text-green-100"
                                            : saveStatus === 'error'
                                                ? "bg-red-500/30 text-red-100"
                                                : "bg-white/20 hover:bg-white/30"
                                    )}
                                >
                                    {saveStatus === 'success' ? (
                                        <Check size={16} />
                                    ) : (
                                        <Save size={16} className={isSaving ? 'animate-pulse' : ''} />
                                    )}
                                    <span className="hidden sm:inline">
                                        {saveStatus === 'success' ? 'Gespeichert!' : saveStatus === 'error' ? 'Fehler' : isSaving ? 'Speichert...' : 'Speichern'}
                                    </span>
                                </button>
                                {/* PDF Download */}
                                <button
                                    onClick={handleDownloadPdf}
                                    className="flex items-center gap-2 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-colors"
                                >
                                    <Download size={16} />
                                    <span className="hidden sm:inline">PDF</span>
                                </button>
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Card Area */}
                        <div className="p-6 bg-gray-50 min-h-[350px] flex flex-col items-center justify-center">
                            {/* Progress */}
                            <div className="w-full max-w-md mb-4">
                                <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                                    <span>Karte {currentIndex + 1} von {flashcards.length}</span>
                                    <span>{Math.round(((currentIndex + 1) / flashcards.length) * 100)}%</span>
                                </div>
                                <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                                        style={{ width: `${((currentIndex + 1) / flashcards.length) * 100}%` }}
                                    />
                                </div>
                            </div>

                            {/* Flashcard */}
                            <div
                                onClick={() => setIsFlipped(!isFlipped)}
                                className="w-full max-w-md aspect-[3/2] perspective-1000 cursor-pointer group"
                            >
                                <motion.div
                                    className="relative w-full h-full"
                                    initial={false}
                                    animate={{ rotateY: isFlipped ? 180 : 0 }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                    style={{ transformStyle: 'preserve-3d' }}
                                >
                                    {/* Front */}
                                    <div
                                        className={cn(
                                            "absolute inset-0 bg-white rounded-2xl shadow-xl border-2 border-indigo-200 p-6 flex flex-col justify-center items-center backface-hidden",
                                            "group-hover:shadow-2xl group-hover:border-indigo-400 transition-all"
                                        )}
                                        style={{ backfaceVisibility: 'hidden' }}
                                    >
                                        <span className="absolute top-3 left-3 px-2 py-1 bg-indigo-100 text-indigo-600 text-[10px] font-bold uppercase rounded-md">
                                            Frage
                                        </span>
                                        <p className="text-lg font-semibold text-gray-800 text-center leading-relaxed">
                                            {currentCard?.front}
                                        </p>
                                        <div className="absolute bottom-3 text-gray-400 text-xs flex items-center gap-1">
                                            <RotateCw size={12} />
                                            Zum Umdrehen klicken
                                        </div>
                                    </div>

                                    {/* Back */}
                                    <div
                                        className={cn(
                                            "absolute inset-0 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl shadow-xl border-2 border-purple-200 p-6 flex flex-col justify-center items-center",
                                            "group-hover:shadow-2xl group-hover:border-purple-400 transition-all"
                                        )}
                                        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                                    >
                                        <span className="absolute top-3 left-3 px-2 py-1 bg-purple-100 text-purple-600 text-[10px] font-bold uppercase rounded-md">
                                            Antwort
                                        </span>
                                        <p className="text-base text-gray-700 text-center leading-relaxed">
                                            {currentCard?.back}
                                        </p>
                                    </div>
                                </motion.div>
                            </div>

                            {/* Navigation */}
                            <div className="flex items-center gap-4 mt-6">
                                <button
                                    onClick={goPrevious}
                                    disabled={currentIndex === 0}
                                    className="p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <button
                                    onClick={() => setIsFlipped(!isFlipped)}
                                    className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-xl font-medium hover:bg-indigo-200 transition-colors"
                                >
                                    <RotateCw size={16} className="inline mr-2" />
                                    Umdrehen
                                </button>
                                <button
                                    onClick={goNext}
                                    disabled={currentIndex === flashcards.length - 1}
                                    className="p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-white border-t border-gray-100 text-center text-xs text-gray-400">
                            Tastaturkürzel: ← Zurück · → Weiter · Leertaste Umdrehen · Esc Schließen
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
