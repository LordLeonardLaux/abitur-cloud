'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SUBJECTS, SUBJECT_COLORS } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Loader2, Check, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function SubjectSelectionPage() {
    const { user, session, loading: authLoading } = useAuth();
    const router = useRouter();
    // const supabase = createClient(); // uses singleton
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedSubjects, setSelectedSubjects] = useState<Record<string, string>>({}); // subjectId -> type

    // Helper: Read token directly from localStorage (bypasses Supabase SDK)
    const getTokenFromLocalStorage = (): string | null => {
        try {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
            // Supabase stores session in localStorage with key like: sb-<project-ref>-auth-token
            const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || '';
            const storageKey = `sb-${projectRef}-auth-token`;
            console.log("Looking for token in localStorage key:", storageKey);
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                console.log("Found session in localStorage, expires_at:", parsed.expires_at);
                return parsed.access_token;
            }
        } catch (e) {
            console.error("Error reading token from localStorage:", e);
        }
        return null;
    };

    // Fetch existing selection
    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            console.log("No user found, redirecting to login");
            router.push('/login');
            return;
        }

        async function loadSubjects() {
            if (!user) return;
            console.log("Loading subjects for user:", user.id);

            // Get token from localStorage FIRST (before any async)
            const token = getTokenFromLocalStorage();
            console.log("Token from localStorage:", token ? "FOUND" : "NOT FOUND");

            if (!token) {
                console.error("No auth token in localStorage - cannot proceed");
                alert("Kein Auth-Token gefunden. Bitte neu einloggen.");
                setLoading(false);
                return;
            }

            // TEST: Check network connectivity directly
            try {
                console.log("Testing raw connectivity...");
                const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
                    method: 'HEAD',
                    headers: { 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! }
                });
                console.log(`Network reachable, status: ${res.status} (OK)`);
            } catch (netErr) {
                console.error("NETWORK ERROR - Cannot reach Supabase:", netErr);
                alert("Netzwerkfehler: Kann Supabase nicht erreichen. Bitte Internet prüfen.");
                setLoading(false);
                return;
            }

            try {
                // Load with RAW FETCH
                console.log("Loading subjects using RAW FETCH with localStorage token...");
                const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_subjects?user_id=eq.${user.id}`, {
                    method: 'GET',
                    headers: {
                        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!res.ok) {
                    const errText = await res.text();
                    throw new Error(`Load failed: ${res.status} ${errText}`);
                }

                const data = await res.json();
                console.log("Loaded data (RAW):", data);

                if (Array.isArray(data)) {
                    const map: Record<string, string> = {};
                    data.forEach((s: any) => {
                        map[s.subject_id] = s.subject_type;
                    });
                    setSelectedSubjects(map);
                }
            } catch (err: any) {
                console.error("Failed to load subjects catch block:", err);
                alert(`Fehler beim Laden: ${err.message}`);
            } finally {
                setLoading(false);
            }
        }
        loadSubjects();
    }, [user, authLoading, router]);

    const toggleSubject = (subjectId: string, type: string) => {
        setSelectedSubjects((prev) => {
            const current = prev[subjectId];
            if (current === type) {
                const copy = { ...prev };
                delete copy[subjectId];
                return copy;
            }
            return { ...prev, [subjectId]: type };
        });
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        console.log("Starting save (RAW FETCH with localStorage token). Selected subjects:", selectedSubjects);

        try {
            // Get auth token from localStorage (bypasses SDK)
            const token = getTokenFromLocalStorage();

            if (!token) throw new Error("Kein Auth-Token in localStorage gefunden. Bitte neu einloggen.");

            // 1. Delete all existing (RAW)
            console.log("Deleting existing subjects (RAW)...");
            const deleteRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_subjects?user_id=eq.${user.id}`, {
                method: 'DELETE',
                headers: {
                    'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                }
            });

            if (!deleteRes.ok) {
                const errText = await deleteRes.text();
                throw new Error(`Delete failed: ${deleteRes.status} ${errText}`);
            }
            console.log("Delete successful (RAW).");

            const rows = Object.entries(selectedSubjects).map(([subjectId, type]) => ({
                user_id: user.id,
                subject_id: subjectId,
                subject_type: type
            }));

            if (rows.length > 0) {
                console.log("Inserting new rows (RAW):", rows);
                const insertRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_subjects`, {
                    method: 'POST',
                    headers: {
                        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify(rows)
                });

                if (!insertRes.ok) {
                    const errText = await insertRes.text();
                    throw new Error(`Insert failed: ${insertRes.status} ${errText}`);
                }
                console.log("Insert successful (RAW).");
            }

            console.log("Save complete, navigating to dashboard with hard reload...");
            // Use window.location for hard navigation (router.refresh doesn't work in Electron static export)
            window.location.href = '/dashboard';
        } catch (err: any) {
            console.error('Failed to save subjects catch block:', err);
            alert(`Fehler beim Speichern: ${err.message || 'Details in der Konsole.'}`);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard" className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
                        <ArrowLeft className="w-6 h-6 text-gray-600" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Fächerwahl</h1>
                        <p className="text-gray-500">Wähle deine Kurse aus (LK, GK, etc.)</p>
                    </div>
                </div>

                <div className="grid gap-6">
                    {SUBJECTS.map((subject) => {
                        const isSelected = !!selectedSubjects[subject.id];
                        const currentType = selectedSubjects[subject.id];

                        return (
                            <div key={subject.id} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={cn("w-3 h-12 rounded-full bg-blue-500")}></div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900">{subject.name}</h3>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    {subject.allowedTypes?.map((type) => {
                                        const isActive = currentType === type;
                                        return (
                                            <button
                                                key={type}
                                                onClick={() => toggleSubject(subject.id, type)}
                                                className={cn(
                                                    "px-4 py-2 rounded-lg font-medium text-sm transition-all border",
                                                    isActive
                                                        ? "bg-blue-600 text-white border-blue-600 shadow-md"
                                                        : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                                                )}
                                            >
                                                {type}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="sticky bottom-6 bg-white/80 backdrop-blur-xl p-4 rounded-2xl shadow-lg border border-gray-200 flex justify-between items-center">
                    <span className="text-gray-600 font-medium ml-2">
                        {Object.keys(selectedSubjects).length} Fächer ausgewählt
                    </span>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-blue-500 disabled:opacity-50 transition-all flex items-center gap-2"
                    >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                        Speichern
                    </button>
                </div>
            </div>
        </main>
    );
}
