'use client';

import { useState } from "react";
import { Sparkles, Loader2, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getApiUrl } from "@/lib/platform";

interface Flashcard {
    front: string;
    back: string;
}

interface FlashcardGenButtonProps {
    pdfText: string;
    topicId: string;
    onSuccess?: (flashcards: Flashcard[]) => void;
}

export function FlashcardGenButton({ pdfText, topicId, onSuccess }: FlashcardGenButtonProps) {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [error, setError] = useState<string | null>(null);

    const generateFlashcards = async () => {
        if (!pdfText || pdfText.length < 50) {
            setError("Der Text ist zu kurz für die Generierung von Karteikarten.");
            setStatus('error');
            return;
        }

        setLoading(true);
        setStatus('idle');
        setError(null);

        try {
            if (typeof window !== 'undefined' && 'electron' in window) {
                // Electron IPC
                const result = await (window as any).electron.aiFlashcards({ content: pdfText });
                if (result.error) throw new Error(result.error);

                setStatus('success');
                if (onSuccess) onSuccess(result.flashcards);
            } else {
                // Web API
                const response = await fetch(getApiUrl('/api/ai/flashcards'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: pdfText }),
                });

                const data = await response.json();

                if (!response.ok) throw new Error(data.error || "Fehler bei der Generierung");

                setStatus('success');
                if (onSuccess) onSuccess(data.flashcards);
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message);
            setStatus('error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative group">
            <button
                onClick={generateFlashcards}
                disabled={loading || !pdfText}
                className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300",
                    "bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30",
                    "hover:from-indigo-500/30 hover:to-purple-500/30 hover:border-indigo-500/50",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    loading && "animate-pulse"
                )}
            >
                {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                ) : status === 'success' ? (
                    <Check className="w-4 h-4 text-green-400" />
                ) : status === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-red-400" />
                ) : (
                    <Sparkles className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                )}
                <span className="text-sm font-medium bg-gradient-to-r from-indigo-200 to-purple-200 bg-clip-text text-transparent">
                    {loading ? "Generiere..." : "KI-Karteikarten"}
                </span>
            </button>

            {error && (
                <div className="absolute top-full mt-2 right-0 w-64 p-3 rounded-lg bg-red-900/50 border border-red-500/50 backdrop-blur-md text-xs text-red-100 z-50">
                    {error}
                </div>
            )}
        </div>
    );
}
