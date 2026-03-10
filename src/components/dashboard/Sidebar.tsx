'use client';

/**
 * Sidebar Component (Refactored)
 * ===============================
 * Presentation Layer - Uses useFriends hook for all friend-related logic.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SUBJECTS } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { Profile } from '@/lib/types';
import { LogOut, Users, Search, X, MessageCircle, FileQuestion, BookOpen, Calendar, GraduationCap, Sparkles, ClipboardList, Shield, UserPlus, Check, Settings, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatWindow } from './ChatWindow';
import { MaterialRequestModal } from './MaterialRequestModal';
import AIChatWindow from '../ai/AIChatWindow';
import { isMobile, showAIFeatures } from '@/lib/platform';
import { useFriends } from '@/hooks/useFriends';
import { TaskHub } from './TaskHub';
import { CreateTaskModal } from '../teacher/CreateTaskModal';
import { getRank, getAvatarWrapperStyle } from '@/lib/ranks';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    onChatOpen?: (friend: Profile) => void;
}

export function Sidebar({ isOpen, onClose, onChatOpen }: SidebarProps) {
    const { user, profile, signOut } = useAuth();
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
        <div className="flex flex-col h-full bg-white">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between pt-[calc(6rem+var(--safe-area-inset-top,0px))] md:pt-6">
                <div className="flex items-center gap-2 min-w-0">
                    <img src="/logo.png" alt="Abitur Cloud Logo" className="w-7 h-7 object-contain flex-shrink-0" />
                    <div className="min-w-0">
                        <h1 className="text-lg font-bold text-gray-900 leading-none truncate">Abitur Cloud</h1>
                        <p className="text-[9px] text-gray-400 mt-0.5 uppercase tracking-widest font-black">Lernplattform</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {profile?.role !== 'teacher' && <div className="hidden md:block"><TaskHub /></div>}
                    <button onClick={onClose} className="md:hidden text-gray-500 hover:bg-gray-100 p-2 rounded-lg">
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* User Profile Card with Rank Border */}
            {profile && (
                <div className="px-4 py-3 border-b border-gray-100">
                    <Link href="/settings/" className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-all">
                        <div style={getAvatarWrapperStyle(profile.xp || 0, profile.rank_visible !== false)}>
                            {profile.avatar_url && profile.avatar_url.trim() !== '' ? (
                                <img
                                    src={profile.avatar_url}
                                    alt={profile.full_name}
                                    className="w-10 h-10 rounded-full object-cover"
                                />
                            ) : (
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                    {profile.full_name?.charAt(0)}
                                </div>
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-gray-900 truncate">{profile.full_name}</p>
                            {profile.rank_visible !== false && (
                                <p className="text-xs font-medium truncate" style={{ color: getRank(profile.xp || 0).color }}>
                                    {getRank(profile.xp || 0).emoji} {getRank(profile.xp || 0).name}
                                </p>
                            )}
                        </div>
                    </Link>
                </div>
            )}

            <div className="p-4 border-b border-gray-100">
                <Link href="/subjects/selection" className="flex items-center gap-3 w-full p-3 bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all font-medium text-sm">
                    <BookOpen size={18} />
                    Fächer bearbeiten
                </Link>

                {profile?.role === 'admin' && (
                    <div className="space-y-2 mt-2">
                        <Link href="/admin/dashboard" className="flex items-center gap-3 w-full p-3 bg-gradient-to-br from-gray-800 to-gray-900 text-white hover:from-black hover:to-gray-800 rounded-xl transition-all font-bold text-sm border border-gray-700 shadow-sm">
                            <Shield size={18} />
                            Admin-Dashboard
                        </Link>
                    </div>
                )}

                {profile?.role === 'teacher' && (
                    <div className="space-y-2 mt-2">
                        <Link href="/teacher/dashboard" className="flex items-center gap-3 w-full p-3 bg-gradient-to-br from-amber-50 to-orange-50 text-amber-700 hover:from-amber-100 hover:to-orange-100 rounded-xl transition-all font-bold text-sm border border-amber-100 shadow-sm">
                            <GraduationCap size={18} />
                            Lehrer-Dashboard
                        </Link>
                        <Link href="/teacher/tasks" className="flex items-center gap-3 w-full p-3 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-xl transition-all font-medium text-sm border border-gray-100 shadow-sm">
                            <ClipboardList size={18} />
                            Alle Aufgaben
                        </Link>
                        <button onClick={() => setIsCreateTaskModalOpen(true)} className="flex items-center gap-3 w-full p-3 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl transition-all font-bold text-sm shadow-sm">
                            <Calendar size={18} />
                            Aufgabe erstellen
                        </button>
                    </div>
                )}

                {showAIFeatures() && profile?.ai_settings?.enabled && (
                    <button onClick={() => { setIsAIChatOpen(true); onClose(); }} className="flex items-center gap-3 w-full p-3 mt-2 bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-700 hover:from-indigo-100 hover:to-purple-100 rounded-xl transition-all font-bold text-sm border border-indigo-100 shadow-sm group">
                        <div className="p-1.5 bg-white rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                            <Sparkles size={16} className="text-indigo-600" />
                        </div>
                        KI-Lernhilfe
                    </button>
                )}

                <Link href="/settings/" className="flex items-center gap-3 w-full p-3 mt-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all font-medium text-sm">
                    <Settings size={18} />
                    Einstellungen
                </Link>

                {profile?.rank_visible !== false && (
                    <Link href="/rank/" className="flex items-center gap-3 w-full p-3 mt-1 text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-xl transition-all font-medium text-sm">
                        <Trophy size={18} />
                        <span>Mein Rang</span>
                        {profile?.xp != null && profile.xp > 0 && (
                            <span className="ml-auto text-xs font-bold bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
                                {profile.xp} XP
                            </span>
                        )}
                    </Link>
                )}

                <button onClick={() => signOut()} className="flex items-center gap-3 w-full p-3 mt-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all font-medium text-sm">
                    <LogOut size={18} />
                    <span>Abmelden</span>
                </button>
            </div>

            <div className="hidden md:block p-4 border-b border-gray-100">
                <div className="flex gap-2">
                    <input type="text" placeholder="Freunde suchen..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <button className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><Search size={18} /></button>
                </div>
            </div>

            <div className="hidden md:block flex-1 overflow-y-auto p-4">
                {/* Search Results */}
                {searchQuery && searchResults.length > 0 && (
                    <div className="mb-4">
                        <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                            <Search size={14} />
                            Suchergebnisse
                        </h3>
                        <div className="space-y-1">
                            {searchResults.map((result) => (
                                <div key={result.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                                    <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                        {result.full_name?.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-gray-900 truncate">{result.full_name}</p>
                                        <p className="text-xs text-gray-400">@{result.username}</p>
                                    </div>
                                    <button onClick={() => sendFriendRequest(result.id)} className="p-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 active:scale-95">
                                        <UserPlus size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Friend Suggestions */}
                {!searchQuery && suggestions.length > 0 && (
                    <div className="mb-4">
                        <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                            <UserPlus size={14} />
                            Vorschläge
                        </h3>
                        <div className="space-y-1">
                            {suggestions.map((sug) => {
                                const isSent = sentRequests.includes(sug.id);
                                return (
                                    <div key={sug.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                                        <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                            {sug.full_name?.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-900 truncate">{sug.full_name}</p>
                                        </div>
                                        {isSent ? (
                                            <span className="p-1.5 bg-orange-100 text-orange-600 rounded-lg text-xs font-bold">
                                                <Check size={14} />
                                            </span>
                                        ) : (
                                            <button onClick={() => sendFriendRequest(sug.id)} className="p-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 active:scale-95">
                                                <UserPlus size={14} />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Pending Requests */}
                {pendingRequests.length > 0 && (
                    <div className="mb-4">
                        <h3 className="flex items-center gap-2 text-xs font-bold text-amber-500 uppercase tracking-widest mb-3">
                            <Users size={14} />
                            Anfragen ({pendingRequests.length})
                        </h3>
                        <div className="space-y-1">
                            {pendingRequests.map((req) => (
                                <div key={req.id} className="flex items-center gap-3 p-3 rounded-xl bg-amber-50">
                                    <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                        {req.profile?.full_name?.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-gray-900 truncate">{req.profile?.full_name}</p>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => acceptRequest(req.id)} className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 active:scale-95"><Check size={14} /></button>
                                        <button onClick={() => rejectRequest(req.id)} className="p-1.5 bg-red-400 text-white rounded-lg hover:bg-red-500 active:scale-95"><X size={14} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Friends List */}
                <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                    <Users size={14} />
                    Klassenkameraden
                </h3>
                {friends.length === 0 && !searchQuery ? (
                    <p className="text-sm text-gray-400 pl-2">Suche oben nach Freunden!</p>
                ) : (
                    <div className="space-y-6">
                        {['12', '13'].map(grade => {
                            const gradeFriends = friends.filter(f => f.grade_level === grade || (!f.grade_level && grade === '12'));
                            if (gradeFriends.length === 0) return null;
                            return (
                                <div key={grade}>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 pl-2">Klasse {grade}</h4>
                                    <div className="space-y-1">
                                        {gradeFriends.map((friend) => (
                                            <div key={friend.id} className="relative group">
                                                <Link href={`/profile?id=${friend.id}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                                                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 ring-white shadow-sm">
                                                        {friend.full_name?.charAt(0)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-gray-900 truncate">{friend.full_name}</p>
                                                    </div>
                                                </Link>
                                                <div className="absolute right-2 top-3 flex md:hidden group-hover:flex items-center gap-1">
                                                    <button onClick={(e) => { e.preventDefault(); const prof = friend as any as Profile; if (onChatOpen) onChatOpen(prof); else setActiveChatFriend(prof); onClose(); }} className="p-1.5 bg-blue-500 text-white shadow-sm rounded-lg hover:bg-blue-600 transition-all active:scale-95"><MessageCircle size={14} /></button>
                                                    <button onClick={(e) => { e.preventDefault(); setActiveChatFriend(friend as any as Profile); setIsRequestModalOpen(true); }} className="p-1.5 bg-indigo-500 text-white shadow-sm rounded-lg hover:bg-indigo-600 transition-all active:scale-95"><FileQuestion size={14} /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <>
            <aside className="hidden md:flex flex-col w-72 border-r border-gray-100 h-screen sticky top-0 bg-white">
                {sidebarContent}
            </aside>
            {isOpen && (
                <div className="md:hidden fixed inset-0 z-[60] flex">
                    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose}></div>
                    <aside className="relative w-72 bg-white h-full shadow-2xl animate-in slide-in-from-left duration-200">
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
