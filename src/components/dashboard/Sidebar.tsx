'use client';

/**
 * Sidebar Component (Refactored)
 * ===============================
 * Presentation Layer - Uses useFriends hook for all friend-related logic.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { Profile } from '@/lib/types';
import { Users, X, BookOpen, Calendar, GraduationCap, Sparkles, ClipboardList, Shield, Settings, Trophy, Library, Sigma, ExternalLink } from 'lucide-react';
import { ChatWindow } from './ChatWindow';
import { MaterialRequestModal } from './MaterialRequestModal';
import AIChatWindow from '../ai/AIChatWindow';
import { showAIFeatures } from '@/lib/platform';
import { useFriends } from '@/hooks/useFriends';
import { SidebarTaskList } from './SidebarTaskList';
import { CreateTaskModal } from '../teacher/CreateTaskModal';
import { getRank, getAvatarWrapperStyle } from '@/lib/ranks';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    onChatOpen?: (friend: Profile) => void;
    mobileOnly?: boolean;
}

export function Sidebar({ isOpen, onClose, onChatOpen, mobileOnly }: SidebarProps) {
    const { user, profile } = useAuth();
    const {
        friends,
        pendingRequests,
        suggestions,
        searchResults,
        searchUsers,
        sendFriendRequest,
        acceptRequest,
        rejectRequest,
        sentRequests,
    } = useFriends();

    const [searchQuery, setSearchQuery] = useState('');
    const [activeChatFriend, setActiveChatFriend] = useState<Profile | null>(null);
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
    const [isAIChatOpen, setIsAIChatOpen] = useState(false);
    const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            searchUsers(searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery, searchUsers]);

    useEffect(() => {
        if (!user) return;
        const fetchUnreadCounts = async () => {
            const { data, error } = await supabase
                .from('messages')
                .select('sender_id')
                .eq('receiver_id', user.id)
                .eq('is_read', false);

            if (!error && data) {
                const counts: Record<string, number> = {};
                data.forEach((m: any) => {
                    counts[m.sender_id] = (counts[m.sender_id] || 0) + 1;
                });
                setUnreadCounts(counts);
            }
        };
        fetchUnreadCounts();
        const channel = supabase.channel('unread_counts').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, () => fetchUnreadCounts()).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [user]);

    const sidebarContent = (
        <div className="flex flex-col h-full">
            {/* Header - Glass effect */}
            <div className="glass-nav px-5 pb-3 flex items-center justify-between pt-[calc(6rem+var(--safe-area-inset-top,0px))] lg:pt-5">
                <div className="flex items-center gap-2.5 min-w-0">
                    <img src="/logo.png" alt="Abitur Cloud Logo" className="w-8 h-8 object-contain flex-shrink-0" />
                    <div className="min-w-0">
                        <h1 className="text-[15px] font-bold text-gray-900 leading-none truncate">Abitur Cloud</h1>
                        <p className="text-[10px] text-gray-400 mt-0.5 font-medium">Lernplattform</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-black/5 transition-colors">
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                {/* Profile */}
                {profile && (
                    <div className="px-3 pt-3 pb-2">
                        <Link href="/settings/" className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-black/[0.03] transition-colors">
                            <div style={getAvatarWrapperStyle(profile.xp || 0, profile.rank_visible !== false)}>
                                {profile.avatar_url && profile.avatar_url.trim() !== '' ? (
                                    <img src={profile.avatar_url} alt={profile.full_name} className="w-10 h-10 rounded-full object-cover" />
                                ) : (
                                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                                        {profile.full_name?.charAt(0)}
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-semibold text-gray-900 truncate">{profile.full_name}</p>
                                {profile.rank_visible !== false && (
                                    <p className="text-[11px] font-medium truncate" style={{ color: getRank(profile.xp || 0).color }}>
                                        {getRank(profile.xp || 0).emoji} {getRank(profile.xp || 0).name}
                                    </p>
                                )}
                            </div>
                            <Settings size={16} className="text-gray-300 flex-shrink-0" />
                        </Link>
                    </div>
                )}

                {/* === SECTION: Navigation === */}
                <div className="px-3 pb-2">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 pb-1.5">Navigation</p>
                    <nav className="space-y-0.5">
                        <Link href="/subjects/selection" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-600 hover:bg-black/[0.03] transition-colors text-[13px] font-medium">
                            <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                                <BookOpen size={14} className="text-blue-600" />
                            </div>
                            Fächer bearbeiten
                        </Link>
                        <Link href="/materials/?view=library" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-600 hover:bg-black/[0.03] transition-colors text-[13px] font-medium">
                            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                                <Library size={14} className="text-indigo-600" />
                            </div>
                            Material-Bibliothek
                        </Link>
                        <Link href="/materials/?view=calendar" className="flex items-center gap-2.5 pl-9 pr-3 py-1.5 rounded-lg text-gray-500 hover:bg-black/[0.03] transition-colors text-[12px] font-medium">
                            <Calendar size={12} className="text-gray-400" />
                            Kalender
                        </Link>
                        <Link href="/materials/?view=list" className="flex items-center gap-2.5 pl-9 pr-3 py-1.5 rounded-lg text-gray-500 hover:bg-black/[0.03] transition-colors text-[12px] font-medium">
                            <ClipboardList size={12} className="text-gray-400" />
                            Liste
                        </Link>
                        <a
                            href="https://mathe.abiturcloud.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-600 hover:bg-black/[0.03] transition-colors text-[13px] font-medium"
                        >
                            <div className="w-7 h-7 rounded-lg bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                                <Sigma size={14} className="text-rose-600" />
                            </div>
                            <span className="flex-1">Mathe lernen</span>
                            <ExternalLink size={12} className="text-gray-300 flex-shrink-0" />
                        </a>
                        <a
                            href="https://mathe.abiturcloud.com/analysis/grundlagen"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2.5 pl-9 pr-3 py-1.5 rounded-lg text-gray-500 hover:bg-black/[0.03] transition-colors text-[12px] font-medium"
                        >
                            <Sparkles size={12} className="text-gray-400" />
                            Grundlagen-Pack
                        </a>
                        <Link href="/friends/" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-600 hover:bg-black/[0.03] transition-colors text-[13px] font-medium">
                            <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                                <Users size={14} className="text-green-600" />
                            </div>
                            <span className="flex-1">Freunde</span>
                            {pendingRequests.length > 0 && (
                                <span className="text-[10px] font-semibold text-white bg-red-500 px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{pendingRequests.length}</span>
                            )}
                        </Link>
                        {profile?.rank_visible !== false && (
                            <Link href="/rank/" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-600 hover:bg-black/[0.03] transition-colors text-[13px] font-medium">
                                <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                                    <Trophy size={14} className="text-purple-600" />
                                </div>
                                <span className="flex-1">Mein Rang</span>
                                {profile?.xp != null && profile.xp > 0 && (
                                    <span className="text-[10px] font-semibold text-purple-500 bg-purple-50 px-1.5 py-0.5 rounded-full">{profile.xp} XP</span>
                                )}
                            </Link>
                        )}
                    </nav>
                </div>

                {/* === SECTION: Rollen-spezifisch === */}
                {(profile?.role === 'admin' || profile?.role === 'teacher' || (showAIFeatures() && profile?.ai_settings?.enabled)) && (
                    <div className="px-3 pb-2">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 pb-1.5">Tools</p>
                        <nav className="space-y-0.5">
                            {profile?.role === 'admin' && (
                                <Link href="/admin/dashboard" className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-gray-900 text-white text-[13px] font-semibold">
                                    <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                                        <Shield size={14} />
                                    </div>
                                    Diktator Dashboard
                                </Link>
                            )}
                            {profile?.role === 'teacher' && (
                                <>
                                    <Link href="/teacher/dashboard" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100/80 transition-colors text-[13px] font-semibold">
                                        <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                                            <GraduationCap size={14} className="text-amber-600" />
                                        </div>
                                        Lehrer-Dashboard
                                    </Link>
                                    <Link href="/teacher/tasks" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-600 hover:bg-black/[0.03] transition-colors text-[13px] font-medium">
                                        <div className="w-7 h-7 rounded-lg bg-gray-500/10 flex items-center justify-center flex-shrink-0">
                                            <ClipboardList size={14} className="text-gray-500" />
                                        </div>
                                        Alle Aufgaben
                                    </Link>
                                    <button onClick={() => setIsCreateTaskModalOpen(true)} className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-700 transition-colors">
                                        <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                                            <Calendar size={14} />
                                        </div>
                                        Aufgabe erstellen
                                    </button>
                                </>
                            )}
                            {showAIFeatures() && profile?.ai_settings?.enabled && (
                                <button onClick={() => { setIsAIChatOpen(true); onClose(); }} className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100/80 transition-colors text-[13px] font-semibold">
                                    <div className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
                                        <Sparkles size={14} className="text-indigo-600" />
                                    </div>
                                    KI-Lernhilfe
                                </button>
                            )}
                        </nav>
                    </div>
                )}

                {/* Inline Task List - flows naturally after Navigation/Tools */}
                {profile && profile.role !== 'teacher' && profile.role !== 'admin' && (
                    <div className="border-t border-gray-100 mt-2">
                        <SidebarTaskList />
                    </div>
                )}

            </div>
        </div>
    );

    return (
        <>
            {!mobileOnly && (
                <aside className="hidden lg:flex flex-col w-[260px] glass border-r border-white/30 h-screen sticky top-0">
                    {sidebarContent}
                </aside>
            )}
            {isOpen && (
                <div className="fixed inset-0 z-[60] flex">
                    <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" onClick={onClose}></div>
                    <aside className="relative w-[280px] glass h-full shadow-2xl animate-in slide-in-from-left duration-200">
                        {sidebarContent}
                    </aside>
                </div>
            )}
            {activeChatFriend && <ChatWindow friend={activeChatFriend} currentUser={user} onClose={() => setActiveChatFriend(null)} />}
            {activeChatFriend && isRequestModalOpen && <MaterialRequestModal friend={activeChatFriend} currentUser={user} onClose={() => setIsRequestModalOpen(false)} onSent={() => setIsRequestModalOpen(false)} />}
            <AIChatWindow isOpen={isAIChatOpen} onClose={() => setIsAIChatOpen(false)} />
            <CreateTaskModal isOpen={isCreateTaskModalOpen} onClose={() => setIsCreateTaskModalOpen(false)} />
        </>
    );
}
