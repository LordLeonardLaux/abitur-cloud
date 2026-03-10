'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PersonalTask {
    id: string;
    student_id: string;
    title: string;
    description: string | null;
    due_date: string | null;
    is_completed: boolean;
    created_at: string;
}

interface UsePersonalTasksReturn {
    personalTasks: PersonalTask[];
    loading: boolean;
    error: string | null;
    openCount: number;
    completedCount: number;
    addTask: (title: string, description?: string, dueDate?: string) => Promise<void>;
    markAsCompleted: (taskId: string, completed: boolean) => Promise<void>;
    deleteTask: (taskId: string) => Promise<void>;
    refresh: () => Promise<void>;
}

export function usePersonalTasks(): UsePersonalTasksReturn {
    const { user, profile } = useAuth();
    const [personalTasks, setPersonalTasks] = useState<PersonalTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTasks = useCallback(async () => {
        if (!user || profile?.role === 'teacher') {
            setPersonalTasks([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { data, error: fetchError } = await supabase
                .from('student_todos')
                .select('*')
                .eq('student_id', user.id)
                .order('created_at', { ascending: false });

            if (fetchError) throw fetchError;
            setPersonalTasks(data || []);
        } catch (err: any) {
            console.error('[usePersonalTasks] Error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [user, profile]);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    const addTask = async (title: string, description?: string, dueDate?: string) => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('student_todos')
                .insert({
                    student_id: user.id,
                    title,
                    description: description || null,
                    due_date: dueDate || null,
                })
                .select()
                .single();

            if (error) throw error;
            setPersonalTasks(prev => [data, ...prev]);
        } catch (err: any) {
            console.error('[usePersonalTasks] addTask error:', err);
            throw err;
        }
    };

    const markAsCompleted = async (taskId: string, completed: boolean) => {
        if (!user) return;
        try {
            const { error } = await supabase
                .from('student_todos')
                .update({ is_completed: completed })
                .eq('id', taskId)
                .eq('student_id', user.id);

            if (error) throw error;
            setPersonalTasks(prev =>
                prev.map(t => t.id === taskId ? { ...t, is_completed: completed } : t)
            );
        } catch (err: any) {
            console.error('[usePersonalTasks] markAsCompleted error:', err);
            throw err;
        }
    };

    const deleteTask = async (taskId: string) => {
        if (!user) return;
        try {
            const { error } = await supabase
                .from('student_todos')
                .delete()
                .eq('id', taskId)
                .eq('student_id', user.id);

            if (error) throw error;
            setPersonalTasks(prev => prev.filter(t => t.id !== taskId));
        } catch (err: any) {
            console.error('[usePersonalTasks] deleteTask error:', err);
            throw err;
        }
    };

    const openCount = personalTasks.filter(t => !t.is_completed).length;
    const completedCount = personalTasks.filter(t => t.is_completed).length;

    return {
        personalTasks,
        loading,
        error,
        openCount,
        completedCount,
        addTask,
        markAsCompleted,
        deleteTask,
        refresh: fetchTasks,
    };
}
