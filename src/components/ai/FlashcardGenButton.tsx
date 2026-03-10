'use client';

import { useState } from "react";
import { Sparkles, Loader2, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getApiUrl, isMobile } from "@/lib/platform";
import { GoogleGenerativeAI } from '@google/generative-ai';
import { useAuth } from '@/contexts/AuthContext';

interface Flashcard {
    front: string;
    back: string;
}

interface FlashcardGenButtonProps {
    pdfText: string;
    topicId: string;
    onSuccess?: (flashcards: Flashcard[]) => void;
}

const FLASHCARD_PROMPT = `Du bist ein Experte für die Erstellung von Lernmaterialien. 
Erstelle aus dem folgenden Text hochwertige Karteikarten für das Abitur.
Jede Karteikarte muss eine Frage (front) und eine Antwort (back) haben.
Die Antwort sollte präzise, aber umfassend sein.
Gib das Ergebnis ausschließlich als JSON-Array von Objekten im folgenden Format zurück:
[
  { "front": "Frage...", "back": "Antwort..." },
  ...
]`;

export function FlashcardGenButton({ pdfText, topicId, onSuccess }: FlashcardGenButtonProps) {
    const { profile } = useAuth();
    const aiSettings = profile?.ai_settings;
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
            // On native mobile, call Gemini directly from the client
            if (isMobile()) {
                let apiKey = null;
                let modelName = 'gemini-2.5-pro';

                if (aiSettings?.enabled && aiSettings.apiKey && aiSettings.provider === 'gemini') {
                    apiKey = aiSettings.apiKey;
                    if (aiSettings.model) modelName = aiSettings.model;
                }

                if (!apiKey) throw new Error('Bitte aktiviere Gemini und hinterlege deinen Schlüssel in den Einstellungen!');

                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    systemInstruction: FLASHCARD_PROMPT,
                    generationConfig: {
                        responseMimeType: 'application/json',
                    }
                });

                const prompt = `${FLASHCARD_PROMPT}\n\nLerninhalt:\n${pdfText}`;
                const result = await model.generateContent(prompt);
                const responseText = result.response.text();
                const flashcards = JSON.parse(responseText);

                setStatus('success');
                if (onSuccess) onSuccess(flashcards);
            } else if (typeof window !== 'undefined' && 'electron' in window) {
                // Electron IPC
                const result = await (window as any).electron.aiFlashcards({ content: pdfText });
                if (result.error) throw new Error(result.error);

                setStatus('success');
                if (onSuccess) onSuccess(result.flashcards);
            } else {
                // Web API (server-side route)
                const response = await fetch(getApiUrl('/api/ai/flashcards'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: pdfText, aiSettings }),
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
