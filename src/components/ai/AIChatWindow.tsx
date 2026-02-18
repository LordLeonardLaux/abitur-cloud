"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Bot, User, Loader2, Sparkles, History } from 'lucide-react';
import { getApiUrl } from '@/lib/platform';
import { motion, AnimatePresence } from 'framer-motion';
import { useAIChatHistory } from '@/hooks/useAIChatHistory';

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
            if (typeof window !== 'undefined' && 'electron' in window) {
                // Electron IPC
                const result = await (window as any).electron.aiChat({
                    messages: msgs,
                    context: context,
                    images: includeImages ? images : undefined
                });
                if (result.error) throw new Error(result.error);
                return result.content;
            } else {
                // Web API
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
                        // Include images for first message (vision analysis)
                        images: includeImages ? images : undefined
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
            throw new Error('Die KI-Lernhilfe ist gerade noch nicht verfügbar. Wir arbeiten daran! 🚧');
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
