'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { Shield, Users, Trash2, CheckCircle, Loader2, ChevronLeft } from 'lucide-react';
import { formatGrade } from '@/lib/utils';
import { Sidebar } from '@/components/dashboard/Sidebar';

export default function AdminDashboardPage() {
    const { user, profile } = useAuth();
    const [pendingUsers, setPendingUsers] = useState<any[]>([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isMounted, setIsMounted] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        setIsMounted(true);
        async function loadData() {
            if (!user) return;

            // Fetch profiles where is_approved is false (or null)
            // Note: We might need to filter client-side if we can't query is_approved directly without index
            // But usually we can.
            const { data: profiles, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('is_approved', false)
                .order('updated_at', { ascending: false });

            if (profiles) {
                setPendingUsers(profiles);
            }
            if (error) {
                console.error('Error loading pending users:', error);
            }

            setLoading(false);
        }
        loadData();
    }, [user]);

    const handleApprove = async (id: string, name: string) => {
        console.log('[Admin] handleApprove START for:', name);
        setProcessingId(id);
        try {
            // Refactored to use API Route for static build compatibility
            const response = await fetch('/api/admin/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: id })
            });
            const result = await response.json();

            console.log('[Admin] approve API result:', result);

            if (result.success) {
                setPendingUsers(prev => prev.filter(u => u.id !== id));
                alert(`Nutzer "${name}" erfolgreich freigeschaltet!`);
            } else {
                alert(`Fehler: ${result.error}`);
            }
        } catch (err: any) {
            console.error('[Admin] EXCEPTION:', err);
            alert('Fehler: ' + err.message);
        } finally {
            setProcessingId(null);
        }
    };

    // Don't render until mounted to avoid hydration mismatch
    if (!isMounted) return null;

    // Redirect non-admins
    if (profile && profile.role !== 'admin') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center p-8 bg-white rounded-2xl shadow-lg">
                    <Shield size={48} className="mx-auto mb-4 text-gray-400" />
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Kein Admin-Zugang</h2>
                    <p className="text-gray-500 mb-4">Diese Seite ist nur für Administratoren zugänglich.</p>
                    <Link href="/dashboard" className="text-blue-600 font-medium hover:underline">
                        Zurück zum Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-gray-50">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
            <div className="flex-1 flex flex-col min-w-0">
                <main className="flex-1 p-4 md:p-8">
                    <div className="max-w-5xl mx-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <Link href="/dashboard" className="p-2 -ml-2 rounded-full hover:bg-gray-200 transition-colors">
                                    <ChevronLeft className="w-6 h-6 text-gray-600" />
                                </Link>
                                <div>
                                    <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">Admin Dashboard</h1>
                                    <p className="text-gray-500 text-sm mt-1">Verwaltung und Übersicht</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsSidebarOpen(true)}
                                className="md:hidden p-2 bg-white border border-gray-100 shadow-sm rounded-xl text-gray-900 active:scale-95"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                            </button>
                        </div>

                        {/* Approved / Pending Requests */}
                        <section className="mb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <Users size={20} className="text-blue-600" />
                                    Ausstehende Freigaben
                                    <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-bold">
                                        {pendingUsers.length}
                                    </span>
                                </h2>
                            </div>

                            {loading ? (
                                <div className="space-y-4">
                                    {[1, 2].map(i => (
                                        <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
                                    ))}
                                </div>
                            ) : pendingUsers.length === 0 ? (
                                <div className="bg-white p-8 rounded-2xl border border-gray-100 text-center">
                                    <p className="text-gray-500">Keine offenen Anfragen.</p>
                                </div>
                            ) : (
                                <div className="bg-white rounded-2xl border-2 border-blue-100 overflow-hidden shadow-sm">
                                    <div className="divide-y divide-gray-50">
                                        {pendingUsers.map(user => (
                                            <div key={user.id} className="p-4 flex items-center justify-between hover:bg-blue-50/30 transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-500">
                                                        {user.full_name?.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-900">{user.full_name}</p>
                                                        <p className="text-xs text-gray-500">{user.email} • @{user.username}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold rounded uppercase">
                                                                {user.role === 'teacher' ? 'Lehrer' : `Klasse ${formatGrade(user.grade_level)}`}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleApprove(user.id, user.full_name)}
                                                        disabled={processingId === user.id}
                                                        className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                                                    >
                                                        {processingId === user.id ? (
                                                            <Loader2 size={14} className="animate-spin" />
                                                        ) : (
                                                            <CheckCircle size={14} />
                                                        )}
                                                        Freischalten
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>
                    </div>
                </main>
            </div>
        </div>
    );
}
