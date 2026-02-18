'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TeacherTask {
    id: string;
    teacher_id: string;
    title: string;
    description: string | null;
    due_date: string | null;
    subject_id: string;
    course_type: string | null; // 'LK' | 'GK' | null
    grade_level: string | null; // '12' | '13' | null
    created_at: string;
    teacher?: {
        full_name: string;
        username: string;
    };
}

export interface TaskStatus {
    id: string;
    task_id: string;
    student_id: string;
    is_completed: boolean;
    seen_at: string | null; // null = NEW
    completed_at: string | null;
}

export interface TaskWithStatus extends TeacherTask {
    status?: TaskStatus;
    isNew: boolean;
    isCompleted: boolean;
}

interface UseTaskHubReturn {
    tasks: TaskWithStatus[];
    loading: boolean;
    error: string | null;
    openCount: number;
    completedCount: number;
    newCount: number;
    markAsSeen: (taskId: string) => Promise<void>;
    markAsCompleted: (taskId: string, completed: boolean) => Promise<void>;
    refresh: () => Promise<void>;
}

export function useTaskHub(): UseTaskHubReturn {
    const { user, profile } = useAuth();
    const [tasks, setTasks] = useState<TaskWithStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTasks = useCallback(async () => {
        if (!user || !profile) {
            setTasks([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            if (profile.role === 'teacher') {
                // Teachers see their OWN created tasks
                const { data: myTasks, error: tasksError } = await supabase
                    .from('teacher_tasks')
                    .select(`
                        *,
                        teacher:profiles!teacher_id(full_name, username)
                    `)
                    .eq('teacher_id', user.id)
                    .order('created_at', { ascending: false });

                if (tasksError) throw tasksError;

                const tasksWithStatus: TaskWithStatus[] = (myTasks || []).map((task: TeacherTask) => ({
                    ...task,
                    isNew: false,
                    isCompleted: false, // Teachers don't complete their own tasks
                }));

                setTasks(tasksWithStatus);
            } else {
                // Students: fetch their subscribed subjects from user_subjects table
                const { data: userSubjectsData, error: subjectsError } = await supabase
                    .from('user_subjects')
                    .select('subject_id')
                    .eq('user_id', user.id);

                if (subjectsError) {
                    console.error('[useTaskHub] Error fetching user subjects:', subjectsError);
                }

                const userSubjectIds = new Set<string>(
                    (userSubjectsData || []).map((s: any) => s.subject_id)
                );

                console.log('[useTaskHub] Student subjects:', Array.from(userSubjectIds));

                if (userSubjectIds.size === 0) {
                    console.log('[useTaskHub] No subjects found for student, showing all tasks');
                }

                // Fetch all tasks
                const { data: allTasks, error: tasksError } = await supabase
                    .from('teacher_tasks')
                    .select(`
                        *,
                        teacher:profiles!teacher_id(full_name, username)
                    `)
                    .order('created_at', { ascending: false });

                if (tasksError) throw tasksError;

                console.log('[useTaskHub] All tasks from DB:', allTasks?.length);

                // Filter tasks based on user's subjects (if they have subjects selected)
                const filteredTasks = (allTasks || []).filter((task: TeacherTask) => {
                    // If student has no subjects configured, show ALL tasks
                    if (userSubjectIds.size === 0) return true;

                    // Check if user has this subject
                    if (userSubjectIds.size > 0 && !userSubjectIds.has(task.subject_id)) {
                        // console.log(`[useTaskHub] Filtered out ${task.title}: Subject mismatch (${task.subject_id})`);
                        return false;
                    }

                    // Check grade level
                    // Only filter if BOTH task and profile have a grade level defined.
                    // If profile.grade_level is missing, we assume the student wants to see all grades (or hasn't configured it yet).
                    if (task.grade_level && profile.grade_level && profile.grade_level !== task.grade_level) {
                        // console.log(`[useTaskHub] Filtered out ${task.title}: Grade mismatch (Task: ${task.grade_level}, User: ${profile.grade_level})`);
                        return false;
                    }

                    return true;
                });

                console.log('[useTaskHub] Filtered tasks:', filteredTasks.length);

                // Fetch statuses for these tasks
                const taskIds = filteredTasks.map((t: TeacherTask) => t.id);
                const { data: statuses, error: statusError } = await supabase
                    .from('student_task_status')
                    .select('*')
                    .eq('student_id', user.id)
                    .in('task_id', taskIds.length > 0 ? taskIds : ['00000000-0000-0000-0000-000000000000']);

                if (statusError) throw statusError;

                // Merge tasks with statuses
                const statusMap = new Map((statuses || []).map((s: TaskStatus) => [s.task_id, s]));
                const tasksWithStatus: TaskWithStatus[] = filteredTasks.map((task: TeacherTask) => {
                    const status = statusMap.get(task.id);
                    return {
                        ...task,
                        status,
                        isNew: !status?.seen_at,
                        isCompleted: status?.is_completed || false,
                    };
                });

                setTasks(tasksWithStatus);
            }
        } catch (err: any) {
            console.error('[useTaskHub] Error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [user, profile]);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    const markAsSeen = useCallback(async (taskId: string) => {
        if (!user) return;

        try {
            const { error } = await supabase
                .from('student_task_status')
                .upsert({
                    task_id: taskId,
                    student_id: user.id,
                    seen_at: new Date().toISOString(),
                }, { onConflict: 'task_id,student_id' });

            if (error) throw error;

            setTasks(prev => prev.map(t =>
                t.id === taskId ? { ...t, isNew: false } : t
            ));
        } catch (err: any) {
            console.error('[useTaskHub] markAsSeen error:', err);
        }
    }, [user]);

    const markAsCompleted = useCallback(async (taskId: string, completed: boolean) => {
        if (!user) return;

        try {
            const { error } = await supabase
                .from('student_task_status')
                .upsert({
                    task_id: taskId,
                    student_id: user.id,
                    is_completed: completed,
                    completed_at: completed ? new Date().toISOString() : null,
                    seen_at: new Date().toISOString(),
                }, { onConflict: 'task_id,student_id' });

            if (error) throw error;

            setTasks(prev => prev.map(t =>
                t.id === taskId ? { ...t, isCompleted: completed, isNew: false } : t
            ));
        } catch (err: any) {
            console.error('[useTaskHub] markAsCompleted error:', err);
        }
    }, [user]);

    const openCount = tasks.filter(t => !t.isCompleted).length;
    const completedCount = tasks.filter(t => t.isCompleted).length;
    const newCount = tasks.filter(t => t.isNew).length;

    return {
        tasks,
        loading,
        error,
        openCount,
        completedCount,
        newCount,
        markAsSeen,
        markAsCompleted,
        refresh: fetchTasks,
    };
}
