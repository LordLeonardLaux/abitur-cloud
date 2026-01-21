'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { ChatMessage } from '@/lib/types';
import { X, Send, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Keyboard } from '@capacitor/keyboard';

interface ChatWindowProps {
    friend: any;
    currentUser: any;
    onClose: () => void;
    isInline?: boolean;
}

export function ChatWindow({ friend, currentUser, onClose, isInline = false }: ChatWindowProps) {

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isOnline, setIsOnline] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        // Mobile Keyboard Listener
        let showListener: any;
        let hideListener: any;

        const setupListeners = async () => {
            showListener = await Keyboard.addListener('keyboardWillShow', info => {
                setKeyboardHeight(info.keyboardHeight);
                setTimeout(scrollToBottom, 100);
            });
            hideListener = await Keyboard.addListener('keyboardWillHide', () => {
                setKeyboardHeight(0);
            });
        };

        setupListeners();

        return () => {
            if (showListener) showListener.remove();
            if (hideListener) hideListener.remove();
        };
    }, []);

    useEffect(() => {
        const fetchMessages = async () => {
            setError(null);
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${friend.id}),and(sender_id.eq.${friend.id},receiver_id.eq.${currentUser.id})`)
                .order('created_at', { ascending: true });

            if (error) {
                console.error("Chat Error:", error);
                if (error.code === 'PGRST116' || error.message.includes('not found')) {
                    setError('Chat-Tabelle fehlt. Bitte chat_setup.sql ausführen.');
                } else {
                    setError('Verbindung zum Chat-Server fehlgeschlagen.');
                }
            } else if (data) {
                setMessages(data);
            }
            setLoading(false);
            scrollToBottom();
        };

        fetchMessages();

        // Presence & Messages Channel
        const channel = supabase.channel(`chat_room:${friend.id}`, {
            config: {
                presence: {
                    key: currentUser.id,
                },
            },
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                setIsOnline(!!state[friend.id]);
            })
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `receiver_id=eq.${currentUser.id}`,
                },
                (payload) => {
                    const msg = payload.new as ChatMessage;
                    if (msg.sender_id === friend.id) {
                        setMessages((prev) => [...prev, msg]);
                    }
                }
            )
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    try {
                        await channel.track({ online_at: new Date().toISOString() });
                    } catch (e) {
                        console.warn("Track failed:", e);
                    }
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [friend.id, currentUser.id]);

    useEffect(scrollToBottom, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        const content = newMessage;
        setNewMessage('');

        const { data, error } = await supabase
            .from('messages')
            .insert([
                {
                    sender_id: currentUser.id,
                    receiver_id: friend.id,
                    content: content,
                    message_type: 'text'
                }
            ])
            .select();

        if (error) {
            console.error("Send Error:", error);
            setError('Fehler beim Senden. Besteht die Tabelle?');
            setNewMessage(content); // Restore message
        } else if (data) {
            setMessages((prev) => [...prev, data[0]]);
        }
    };

    return (
        <div
            style={{ marginBottom: isInline ? 0 : keyboardHeight }}
            className={cn(
                "bg-white flex flex-col transition-all duration-300 ease-out",
                isInline
                    ? "h-full w-full"
                    : "fixed bottom-0 right-0 md:right-80 w-full md:w-96 shadow-2xl rounded-t-2xl border border-gray-100 z-50 h-[500px] max-h-[90vh]"
            )}
        >

            {/* Header */}
            <div className={cn(
                "p-4 border-b border-gray-100 flex items-center justify-between bg-white",
                !isInline && "rounded-t-2xl pt-[calc(1rem+var(--safe-area-inset-top))]"
            )}>

                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold relative">
                        {friend.full_name?.charAt(0)}
                        {isOnline && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></span>
                        )}
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-900">{friend.full_name}</h3>
                        <p className={cn(
                            "text-[10px] font-medium transition-colors",
                            isOnline ? "text-green-500" : "text-gray-400"
                        )}>
                            {isOnline ? 'Online' : 'Offline'}
                        </p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded-lg text-gray-400">
                    <X size={18} />
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs flex flex-col items-center text-center gap-2">
                        <p className="font-bold">Chat-Fehler</p>
                        <p>{error}</p>
                    </div>
                )}
                {loading ? (
                    <div className="flex justify-center items-center h-full">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    </div>
                ) : messages.length === 0 && !error ? (
                    <div className="text-center mt-10">
                        <MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                        <p className="text-sm text-gray-400">Sag mal Hallo!</p>
                    </div>
                ) : (
                    messages.map((msg, i) => (
                        <div
                            key={msg.id || i}
                            className={cn(
                                "flex flex-col max-w-[80%]",
                                msg.sender_id === currentUser.id ? "ml-auto items-end" : "items-start"
                            )}
                        >
                            <div
                                className={cn(
                                    "p-3 rounded-2xl text-sm shadow-sm",
                                    msg.sender_id === currentUser.id
                                        ? "bg-blue-600 text-white rounded-tr-none"
                                        : "bg-white text-gray-800 border border-gray-100 rounded-tl-none"
                                )}
                            >
                                <p>{msg.content}</p>
                            </div>
                            <span className="text-[10px] text-gray-400 mt-1 px-1">
                                {format(new Date(msg.created_at || Date.now()), 'HH:mm', { locale: de })}
                            </span>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className={cn(
                "p-4 border-t border-gray-100 bg-white",
                !isInline && "pb-[calc(1rem+var(--safe-area-inset-bottom))]"
            )}>

                <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Nachricht schreiben..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="flex-1 px-3 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
}
