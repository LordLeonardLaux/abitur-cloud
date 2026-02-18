'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Message {
    role: 'user' | 'ai';
    content: string;
    timestamp?: string;
}

interface UseAIChatHistoryProps {
    topicId?: string;
    materialId?: string;
}

interface UseAIChatHistoryReturn {
    messages: Message[];
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    loading: boolean;
    error: string | null;
    saveMessages: (newMessages: Message[]) => Promise<void>;
}

export function useAIChatHistory({ topicId, materialId }: UseAIChatHistoryProps): UseAIChatHistoryReturn {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [historyId, setHistoryId] = useState<string | null>(null);

    // Load existing chat history on mount
    useEffect(() => {
        if (!user || (!topicId && !materialId)) {
            setLoading(false);
            return;
        }

        const loadHistory = async () => {
            setLoading(true);
            setError(null);

            try {
                let query = supabase
                    .from('ai_chat_history')
                    .select('*')
                    .eq('user_id', user.id);

                if (topicId) {
                    query = query.eq('topic_id', topicId);
                } else if (materialId) {
                    query = query.eq('teacher_material_id', materialId);
                }

                const { data, error: fetchError } = await query.single();

                if (fetchError && fetchError.code !== 'PGRST116') {
                    // PGRST116 = no rows returned, which is fine
                    throw fetchError;
                }

                if (data) {
                    setHistoryId(data.id);
                    setMessages(data.messages || []);
                    console.log('[useAIChatHistory] Loaded existing chat:', data.messages?.length, 'messages');
                } else {
                    console.log('[useAIChatHistory] No existing chat history found');
                }
            } catch (err: any) {
                console.error('[useAIChatHistory] Load error:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        loadHistory();
    }, [user, topicId, materialId]);

    // Save messages to database
    const saveMessages = useCallback(async (newMessages: Message[]) => {
        if (!user || (!topicId && !materialId)) {
            console.warn('[useAIChatHistory] Cannot save: no user or topic/material');
            return;
        }

        try {
            const payload = {
                user_id: user.id,
                topic_id: topicId || null,
                teacher_material_id: materialId || null,
                messages: newMessages,
                updated_at: new Date().toISOString(),
            };

            if (historyId) {
                // Update existing record
                const { error: updateError } = await supabase
                    .from('ai_chat_history')
                    .update({ messages: newMessages, updated_at: new Date().toISOString() })
                    .eq('id', historyId);

                if (updateError) throw updateError;
            } else {
                // Insert new record
                const { data, error: insertError } = await supabase
                    .from('ai_chat_history')
                    .insert(payload)
                    .select()
                    .single();

                if (insertError) throw insertError;
                if (data) setHistoryId(data.id);
            }

            console.log('[useAIChatHistory] Saved', newMessages.length, 'messages');
        } catch (err: any) {
            console.error('[useAIChatHistory] Save error:', err);
            setError(err.message);
        }
    }, [user, topicId, materialId, historyId]);

    return {
        messages,
        setMessages,
        loading,
        error,
        saveMessages,
    };
}
