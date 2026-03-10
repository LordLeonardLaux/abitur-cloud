"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Bot, User, Loader2, Sparkles, History } from 'lucide-react';
import { getApiUrl, isMobile } from '@/lib/platform';
import { motion, AnimatePresence } from 'framer-motion';
import { useAIChatHistory } from '@/hooks/useAIChatHistory';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { useAuth } from '@/contexts/AuthContext';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
    role: 'user' | 'ai';
    content: string;
}

interface AIChatWindowProps {
    isOpen: boolean;
    onClose: () => void;
    context?: string; // Optional text context from a PDF or Topic
    initialMessage?: string; // Optional message to send automatically on open
    images?: Array<{ base64: string, mimeType: string }>; // NEW: PDF page images for vision
    topicId?: string; // NEW: For persistent chat history
    materialId?: string; // NEW: For teacher material chat history
}

export default function AIChatWindow({ isOpen, onClose, context, initialMessage, images, topicId, materialId }: AIChatWindowProps) {
    // Persistent chat history
    const {
        messages: savedMessages,
        loading: historyLoading,
        saveMessages,
    } = useAIChatHistory({ topicId, materialId });

    const { profile } = useAuth();
    const aiSettings = profile?.ai_settings;

    const [messages, setMessages] = useState<Message[]>([
        { role: 'ai', content: 'Hallo! Ich bin deine Abitur Cloud Lernhilfe. Wie kann ich dir heute beim Lernen helfen?' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load saved messages when history is ready
    useEffect(() => {
        if (!historyLoading && savedMessages.length > 0 && !hasLoadedHistory) {
            setMessages(savedMessages);
            setHasLoadedHistory(true);
            console.log('[AIChatWindow] Loaded', savedMessages.length, 'messages from history');
        }
    }, [historyLoading, savedMessages, hasLoadedHistory]);

    // Reset when closing
    useEffect(() => {
        if (!isOpen) {
            setHasLoadedHistory(false);
        }
    }, [isOpen]);

    // Handle initial message
    useEffect(() => {
        if (isOpen && initialMessage) {
            // Wait a tiny bit for the window to animate in
            const timer = setTimeout(() => {
                handleInitialMessage(initialMessage);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [isOpen, initialMessage]);

    const callAI = async (msgs: Message[], context?: string, includeImages: boolean = false) => {
        try {
            // On native mobile (iOS/Android), call AI directly from the client
            // because the Next.js API routes don't exist on static exports
            if (isMobile()) {
                let apiKey = null;
                let provider = 'gemini';
                let modelName = 'gemini-2.5-pro';

                // Overlay user AI settings if enabled
                if (aiSettings?.enabled && aiSettings.apiKey) {
                    apiKey = aiSettings.apiKey;
                    provider = aiSettings.provider;
                    if (aiSettings.model) modelName = aiSettings.model;
                }

                if (!apiKey) throw new Error('Bitte hinterlege zuerst deinen eigenen KI-Schlüssel in den Einstellungen!');

                const hasImgs = includeImages && images && images.length > 0;

                const systemPrompt = 'Du bist die Abitur Cloud Lernhilfe, ein hilfreicher KI-Assistent für Schüler der Oberstufe. Dein Ziel ist es, Schülern beim Verständnis von Lerninhalten zu helfen, Konzepte zu erklären und Fragen zu den Unterrichtsmaterialien zu beantworten. Bleibe sachlich, freundlich und unterstützend. Erkläre komplexe Sachverhalte einfach und verständlich. Wenn du Bilder von handgeschriebenen Notizen, Diagrammen oder PDF-Seiten erhältst, analysiere diese sorgfältig und transkribiere den handschriftlichen Inhalt. Beziehe dich auf die visuellen Inhalte, wenn sie relevant sind. WICHTIG: Verwende NIEMALS LaTeX-Notation (kein $, \\frac, \\vec, \\cdot etc.). Schreibe Mathematik immer in lesbarem Klartext mit Unicode-Zeichen.';

                if (provider === 'openai') {
                    // Raw REST fetch for OpenAI on Mobile
                    let userText = msgs[msgs.length - 1].content;
                    if (context) userText = `KONTEXT:\n${context}\n\nFRAGE:\n${userText}`;

                    const openAiMessages = [
                        { role: 'system', content: systemPrompt },
                        ...msgs.slice(0, -1).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
                        { role: 'user', content: userText }
                    ];

                    // Attach images to the very last message if available
                    if (hasImgs && images) {
                        const contentArray: any[] = [{ type: 'text', text: userText }];
                        for (let i = 0; i < Math.min(images.length, 2); i++) {
                            const img = images[i];
                            if (img.base64 && img.mimeType) {
                                contentArray.push({
                                    type: 'image_url',
                                    image_url: { url: `data:${img.mimeType};base64,${img.base64.replace(/^data:image\/\w+;base64,/, '')}` }
                                });
                            }
                        }
                        openAiMessages[openAiMessages.length - 1].content = contentArray as any;
                    }

                    const res = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify({
                            model: hasImgs ? 'gpt-4o' : 'gpt-4o-mini',
                            messages: openAiMessages
                        })
                    });

                    if (!res.ok) throw new Error('OpenAI API Fehler.');
                    const data = await res.json();
                    return data.choices[0].message.content;

                } else {
                    // Gemini via SDK
                    const genAI = new GoogleGenerativeAI(apiKey);
                    const model = genAI.getGenerativeModel({
                        model: modelName,
                        systemInstruction: systemPrompt
                    });

                    // Build history (all but last message)
                    const history = msgs.slice(0, -1).map(m => ({
                        role: m.role === 'user' ? 'user' as const : 'model' as const,
                        parts: [{ text: m.content }],
                    }));

                    const chatSession = model.startChat({
                        history,
                        generationConfig: { maxOutputTokens: 4096 },
                    });

                    const currentMessage = msgs[msgs.length - 1].content;

                    // Build multimodal parts
                    const parts: any[] = [];
                    if (context) {
                        parts.push({ text: `KONTEXT AUS DEM LERNMATERIAL:\n${context}\n\n` });
                    }
                    if (hasImgs && images) {
                        parts.push({ text: 'BILDER DER SEITEN (analysiere handschriftliche Inhalte sorgfältig):\n' });
                        for (let i = 0; i < Math.min(images.length, 2); i++) {
                            const img = images[i];
                            if (img.base64 && img.mimeType) {
                                parts.push({
                                    inlineData: {
                                        data: img.base64.replace(/^data:image\/\w+;base64,/, ''),
                                        mimeType: img.mimeType
                                    }
                                });
                                parts.push({ text: `[Seite ${i + 1}]\n` });
                            }
                        }
                    }
                    parts.push({ text: `\nFRAGE DES SCHÜLERS:\n${currentMessage}` });

                    const result = await chatSession.sendMessage(parts);
                    return result.response.text();
                }
            }

            if (typeof window !== 'undefined' && 'electron' in window) {
                // Electron IPC
                const result = await (window as any).electron.aiChat({
                    messages: msgs,
                    context: context,
                    images: includeImages ? images : undefined,
                    aiSettings: aiSettings
                });
                if (result.error) throw new Error(result.error);
                return result.content;
            } else {
                // Web API (server-side route)
                const apiUrl = getApiUrl('/api/ai/chat');
                console.log('[AIChatWindow] Calling:', apiUrl);

                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                    },
                    body: JSON.stringify({
                        messages: msgs.map(m => ({
                            role: m.role === 'ai' ? 'model' : 'user',
                            content: m.content
                        })),
                        context: context,
                        images: includeImages ? images : undefined,
                        aiSettings: aiSettings
                    }),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[AIChatWindow] API Error Status:', response.status, errorText);
                    throw new Error(`KI-Dienst antwortet nicht (Status: ${response.status}).`);
                }

                const data = await response.json();
                if (data.error) throw new Error(data.error);
                if (!data.content) throw new Error("Keine Antwort von der KI erhalten.");
                return data.content;
            }
        } catch (error: any) {
            console.error('[AIChatWindow] AI error:', error);
            // Show real error on mobile for debugging, generic on web
            const msg = isMobile()
                ? `Fehler: ${error.message || error}`
                : 'Die KI-Lernhilfe ist gerade noch nicht verfügbar. Wir arbeiten daran! 🚧';
            throw new Error(msg);
        }
    };

    const handleInitialMessage = async (msg: string) => {
        setInput('');
        const userMsg: Message = { role: 'user', content: msg };
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        try {
            const history = [userMsg];
            const content = await callAI(history, context, images && images.length > 0);
            const aiMsg: Message = { role: 'ai', content };

            setMessages(prev => {
                const newMessages = [...prev, aiMsg];
                // Auto-save after AI responds
                if (topicId || materialId) {
                    saveMessages(newMessages);
                }
                return newMessages;
            });
        } catch (error: any) {
            setMessages(prev => [...prev, { role: 'ai', content: `Entschuldigung, es gab einen Fehler: ${error.message}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        const userMsg: Message = { role: 'user', content: userMessage };
        setInput('');
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        try {
            const newHistory = messages.slice(1).concat(userMsg);
            // Always include images when available so AI can reference handwritten/visual content
            const content = await callAI(newHistory, context, !!(images && images.length > 0));
            const aiMsg: Message = { role: 'ai', content };

            setMessages(prev => {
                const newMessages = [...prev, aiMsg];
                // Auto-save after AI responds
                if (topicId || materialId) {
                    saveMessages(newMessages);
                }
                return newMessages;
            });
        } catch (error: any) {
            setMessages(prev => [...prev, { role: 'ai', content: `Entschuldigung, es gab einen Fehler: ${error.message}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="fixed right-0 top-0 h-full w-full sm:w-[400px] bg-white shadow-2xl z-[100] flex flex-col border-l border-gray-100"
                >
                    {/* Header */}
                    <div className="p-4 pt-[calc(1rem+env(safe-area-inset-top))] border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <Sparkles size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold">Lernhilfe (KI)</h3>
                                <p className="text-[10px] opacity-80 uppercase tracking-widest font-black">Powered by Gemini</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                    <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${msg.role === 'user' ? 'bg-blue-100 text-blue-600' : 'bg-indigo-100 text-indigo-600'
                                        }`}>
                                        {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                                    </div>
                                    <div className={`p-3 rounded-2xl text-sm shadow-sm prose prose-sm max-w-none ${msg.role === 'user'
                                        ? 'bg-blue-600 text-white rounded-tr-none'
                                        : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                                        }`}>
                                        {msg.role === 'ai' ? (
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                                                    ul: ({ children }) => <ul className="list-disc ml-4 mb-2 space-y-1">{children}</ul>,
                                                    ol: ({ children }) => <ol className="list-decimal ml-4 mb-2 space-y-1">{children}</ol>,
                                                    h1: ({ children }) => <h1 className="text-base font-bold mb-2 uppercase tracking-tight">{children}</h1>,
                                                    h2: ({ children }) => <h2 className="text-sm font-bold mb-1">{children}</h2>,
                                                    h3: ({ children }) => <h3 className="text-sm font-semibold mb-1">{children}</h3>,
                                                    code: ({ children }) => <code className="bg-gray-100 px-1 rounded text-[12px] font-mono">{children}</code>
                                                }}
                                            >
                                                {msg.content}
                                            </ReactMarkdown>
                                        ) : (
                                            msg.content
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="flex gap-2 max-w-[85%]">
                                    <div className="shrink-0 w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                        <Bot size={16} />
                                    </div>
                                    <div className="p-3 rounded-2xl bg-white border border-gray-100 rounded-tl-none flex items-center gap-2 text-gray-400 italic text-xs shadow-sm">
                                        <Loader2 size={12} className="animate-spin" />
                                        Überlegt...
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-white border-t border-gray-100">
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleSend();
                            }}
                            className="relative flex items-center gap-2"
                        >
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Stelle eine Frage zu deinem Lernstoff..."
                                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || isLoading}
                                className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-blue-500/20"
                            >
                                <Send size={20} />
                            </button>
                        </form>
                        <p className="mt-2 text-[10px] text-gray-400 text-center">
                            KI kann Fehler machen. Überprüfe wichtige Informationen.
                        </p>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
