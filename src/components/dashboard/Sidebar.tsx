'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SUBJECTS } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { Profile } from '@/lib/types';
import { LogOut, Users, Search, ChevronRight, X, MessageCircle, FileQuestion, BookOpen, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatWindow } from './ChatWindow';
import { MaterialRequestModal } from './MaterialRequestModal';

// Re-define Profile locally if not exported clearly, or import it.
// Based on usage in page.tsx, it seems Profile matches the DB schema.

interface SidebarProps {
    isOpen: boolean;    // For mobile
    onClose: () => void; // For mobile
    onChatOpen?: (friend: any) => void;
}


export function Sidebar({ isOpen, onClose, onChatOpen }: SidebarProps) {

    const { user, profile, signOut } = useAuth();

    // State moved from page.tsx
    const [friends, setFriends] = useState<any[]>([]); // Using any[] to be safe if types differ, iterating on Profile
    const [friendSubjects, setFriendSubjects] = useState<Record<string, Record<string, string>>>({});
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [sentRequests, setSentRequests] = useState<string[]>([]);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [activeChatFriend, setActiveChatFriend] = useState<Profile | null>(null);
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

    const fetchProfiles = async (ids: string[], token: string) => {
        return fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?id=in.(${ids.join(',')})`,
            {
                headers: {
                    'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                    'Authorization': `Bearer ${token}`,
                }
            }
        );
    };

    const getTokenFromLocalStorage = (): string | null => {
        try {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
            const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || '';
            const storageKey = `sb-${projectRef}-auth-token`;
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                return parsed.access_token;
            }
        } catch (e) {
            console.error("Error reading token:", e);
        }
        return null;
    };

    useEffect(() => {
        const fetchFriends = async () => {
            if (!user) return;
            const token = getTokenFromLocalStorage();
            if (!token) return;

            try {
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/friendships?or=(user_id.eq.${user.id},friend_id.eq.${user.id})&status=eq.accepted`,
                    { headers: { 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, 'Authorization': `Bearer ${token}` } }
                );
                if (res.ok) {
                    const friendships = await res.json();
                    if (friendships && friendships.length > 0) {
                        const friendIds = friendships.map((f: any) => f.user_id === user.id ? f.friend_id : f.user_id);

                        const profilesRes = await fetchProfiles(friendIds, token);
                        if (profilesRes.ok) {
                            const profiles = await profilesRes.json();
                            setFriends(profiles);

                            const subjectsRes = await fetch(
                                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_subjects?user_id=in.(${friendIds.join(',')})`,
                                { headers: { 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, 'Authorization': `Bearer ${token}` } }
                            );

                            if (subjectsRes.ok) {
                                const subjectsData = await subjectsRes.json();
                                const grouped: Record<string, Record<string, string>> = {};
                                subjectsData.forEach((s: any) => {
                                    if (!grouped[s.user_id]) grouped[s.user_id] = {};
                                    grouped[s.user_id][s.subject_id] = s.subject_type;
                                });
                                setFriendSubjects(grouped);
                            }
                        }

                        if (profile && profile.grade_level) {
                            const { data: suggestedUsers } = await supabase
                                .from('profiles')
                                .select('*')
                                .eq('grade_level', profile.grade_level)
                                .neq('id', profile.id)
                                .not('id', 'in', `(${friendIds.join(',')})`)
                                .limit(10);

                            if (suggestedUsers) setSuggestions(suggestedUsers.slice(0, 3));
                        }
                    } else {
                        setFriends([]);
                        setSuggestions([]);
                    }
                }
            } catch (e) {
                console.error("Fetch friends failed:", e);
            }
        };

        const fetchPendingRequests = async () => {
            if (!user) return;
            const token = getTokenFromLocalStorage();
            if (!token) return;

            try {
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/friendships?friend_id=eq.${user.id}&status=eq.pending`,
                    { headers: { 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, 'Authorization': `Bearer ${token}` } }
                );
                if (res.ok) {
                    const requests = await res.json();
                    if (requests.length > 0) {
                        const requesterIds = requests.map((r: any) => r.user_id);
                        const profilesRes = await fetch(
                            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?id=in.(${requesterIds.join(',')})`,
                            { headers: { 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, 'Authorization': `Bearer ${token}` } }
                        );
                        if (profilesRes.ok) {
                            const profiles = await profilesRes.json();
                            const merged = requests.map((r: any) => ({
                                ...r,
                                profile: profiles.find((p: any) => p.id === r.user_id)
                            }));
                            setPendingRequests(merged);
                        }
                    }
                }
            } catch (e) {
                console.error("Fetch requests failed:", e);
            }
        };

        fetchFriends();
        fetchPendingRequests();

        // Fetch unread counts
        const fetchUnreadCounts = async () => {
            if (!user) return;
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

        // Global Presence Channel (For Online-Status in real-time)
        if (!user || !profile) return;

        const presenceChannel = supabase.channel('global_presence', {
            config: {
                presence: {
                    key: user.id,
                },
            },
        });

        presenceChannel
            .on('presence', { event: 'sync' }, () => {
                // Tracking online users could be done here if we wanted a global list
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    try {
                        await presenceChannel.track({
                            online_at: new Date().toISOString(),
                            full_name: profile.full_name
                        });
                    } catch (e) {
                        console.warn("Presence tracking failed (Realtime service might be down)");
                    }
                }
            });

        // Real-time listener for unread counts
        const messagesChannel = supabase
            .channel('unread_counts')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
                () => fetchUnreadCounts()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(presenceChannel);
            supabase.removeChannel(messagesChannel);
        };
    }, [user, profile]);

    // Debounced search for friends
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery.trim()) {
                handleSearch();
            } else {
                setSearchResults([]);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleSearch = async () => {
        if (!searchQuery.trim() || !user) return;
        setSearching(true);
        const token = getTokenFromLocalStorage();
        if (!token) { setSearching(false); return; }

        try {
            const query = encodeURIComponent(searchQuery);
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?or=(username.ilike.*${query}*,full_name.ilike.*${query}*,email.ilike.*${query}*)&id=neq.${user.id}&limit=10`,
                { headers: { 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, 'Authorization': `Bearer ${token}` } }
            );
            if (res.ok) {
                const data = await res.json();
                setSearchResults(data);
            }
        } catch (e) {
            console.error("Search failed:", e);
        } finally {
            setSearching(false);
        }
    };

    const sendFriendRequest = async (friendId: string) => {
        if (!user) return;
        const token = getTokenFromLocalStorage();
        if (!token) return;

        try {
            const checkRes = await fetch(
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/friendships?or=(and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id}))`,
                { headers: { 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, 'Authorization': `Bearer ${token}` } }
            );

            if (checkRes.ok) {
                const existing = await checkRes.json();
                if (existing.length > 0) {
                    const existingRequest = existing[0];
                    if (existingRequest.user_id === friendId && existingRequest.status === 'pending') {
                        await acceptRequest(existingRequest.id);
                        return;
                    }
                    setSentRequests(prev => [...prev, friendId]);
                    return;
                }
            }

            const res = await fetch(
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/friendships`,
                {
                    method: 'POST',
                    headers: {
                        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify({ user_id: user.id, friend_id: friendId, status: 'pending' })
                }
            );
            if (res.ok || res.status === 409) {
                setSentRequests(prev => [...prev, friendId]);
            }
        } catch (e) {
            console.error("Error sending request:", e);
        }
    };

    const acceptRequest = async (requestId: string) => {
        const token = getTokenFromLocalStorage();
        if (!token) return;
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/friendships?id=eq.${requestId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify({ status: 'accepted' })
                }
            );
            if (res.ok) window.location.reload();
        } catch (e) { console.error("Error accepting:", e); }
    };

    const rejectRequest = async (requestId: string) => {
        const token = getTokenFromLocalStorage();
        if (!token) return;
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/friendships?id=eq.${requestId}`,
                {
                    method: 'DELETE',
                    headers: { 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, 'Authorization': `Bearer ${token}` }
                }
            );
            if (res.ok) setPendingRequests(prev => prev.filter(r => r.id !== requestId));
        } catch (e) { console.error("Error rejecting:", e); }
    };

    const SidebarContent = () => (
        <div className="flex flex-col h-full bg-white">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between pt-[calc(6rem+var(--safe-area-inset-top,0px))]">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Abitur Cloud</h1>
                    <p className="text-sm text-gray-500 mt-1">Hallo, {profile?.full_name || 'User'}!</p>
                </div>
                {/* Mobile Close Button */}
                <button onClick={onClose} className="md:hidden text-gray-500 hover:bg-gray-100 p-2 rounded-lg">
                    <X size={20} />
                </button>
            </div>

            {/* Subject Management Link */}
            <div className="p-4 border-b border-gray-100">
                <Link
                    href="/subjects/selection"
                    className="flex items-center gap-3 w-full p-3 bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all font-medium text-sm"
                >
                    <BookOpen size={18} />
                    Fächer bearbeiten
                </Link>
            </div>

            {/* Friend Search */}
            <div className="p-4 border-b border-gray-100">
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Freunde suchen..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button onClick={handleSearch} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                        <Search size={18} />
                    </button>
                </div>
                {searchResults.length > 0 && (
                    <div className="mt-2 bg-gray-50 rounded-lg p-2 space-y-1">
                        {searchResults.map((p) => {
                            const alreadySent = sentRequests.includes(p.id);
                            const alreadyFriend = friends.some(f => f.id === p.id);
                            return (
                                <div key={p.id} className="flex items-center gap-2 p-2 hover:bg-white rounded-lg">
                                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">
                                        {p.full_name?.charAt(0) || '?'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate">{p.full_name}</p>
                                        <p className="text-xs text-gray-500 truncate">@{p.username}</p>
                                    </div>
                                    {alreadyFriend ? (
                                        <span className="text-xs text-green-600 font-medium">✓ Freund</span>
                                    ) : alreadySent ? (
                                        <span className="text-xs text-gray-400">Gesendet</span>
                                    ) : (
                                        <button onClick={() => sendFriendRequest(p.id)} className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600">+ Anfrage</button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Pending Requests */}
            {pendingRequests.length > 0 && (
                <div className="p-4 border-b border-gray-100">
                    <div className="space-y-2">
                        {pendingRequests.map((req) => (
                            <div key={req.id} className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg">
                                <span className="text-xs font-bold text-orange-600">{req.profile?.full_name}</span>
                                <div className="flex-1"></div>
                                <button onClick={() => acceptRequest(req.id)} className="text-xs bg-green-500 text-white px-2 py-1 rounded">✓</button>
                                <button onClick={() => rejectRequest(req.id)} className="text-xs bg-red-500 text-white px-2 py-1 rounded">✕</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Suggestions */}
            {suggestions.length > 0 && (
                <div className="p-4 border-b border-gray-100 bg-blue-50/50">
                    <h3 className="flex items-center gap-2 text-xs font-bold text-blue-500 uppercase tracking-widest mb-3">
                        <Users size={14} />
                        Vorschläge
                    </h3>
                    <div className="space-y-2">
                        {suggestions.map((p) => (
                            <div key={p.id} className="flex items-center gap-2">
                                <span className="text-sm flex-1">{p.full_name}</span>
                                <button onClick={() => sendFriendRequest(p.id)} className="text-xs bg-white text-blue-600 border border-blue-200 px-2 py-1 rounded">+</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Friends List */}
            <div className="flex-1 overflow-y-auto p-4">
                <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                    <Users size={14} />
                    Klassenkameraden
                </h3>
                <div className="space-y-6">
                    {['12', '13'].map(grade => {
                        const gradeFriends = friends.filter(f => f.grade_level === grade || (!f.grade_level && grade === '12'));
                        if (gradeFriends.length === 0) return null;
                        return (
                            <div key={grade}>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 pl-2">Klasse {grade}</h4>
                                <div className="space-y-1">
                                    {gradeFriends.map((friend) => {
                                        const subjects = friendSubjects[friend.id] || {};
                                        const subjectTags = Object.entries(subjects).map(([id, type]) => {
                                            const subjectName = SUBJECTS.find(s => s.id === id)?.name?.substring(0, 2) || id.substring(0, 2);
                                            return `${subjectName}:${type}`;
                                        });
                                        return (
                                            <div key={friend.id} className="relative group">
                                                <Link
                                                    href={`/profile?id=${friend.id}`}
                                                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
                                                >
                                                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 ring-white shadow-sm">
                                                        {friend.full_name?.charAt(0)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between">
                                                            <p className="text-sm font-bold text-gray-900 truncate">{friend.full_name}</p>
                                                            {unreadCounts[friend.id] > 0 && (
                                                                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                                                            )}
                                                        </div>
                                                        {subjectTags.length > 0 && <div className="flex gap-1 mt-0.5 text-[9px] text-blue-500 font-bold uppercase overflow-hidden whitespace-nowrap opacity-60 group-hover:opacity-100 transition-opacity">{subjectTags.slice(0, 3).join(' ')}</div>}
                                                    </div>
                                                </Link>

                                                {/* Chat & Material Request Quick Actions */}
                                                <div className="absolute right-2 top-3 flex md:hidden group-hover:flex items-center gap-1">
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            if (onChatOpen) {
                                                                onChatOpen(friend);
                                                            } else {
                                                                setActiveChatFriend(friend);
                                                            }
                                                            // Mark as read

                                                            setUnreadCounts(prev => ({ ...prev, [friend.id]: 0 }));
                                                            supabase.from('messages').update({ is_read: true }).eq('sender_id', friend.id).eq('receiver_id', user?.id);
                                                            onClose(); // Close sidebar on mobile
                                                        }}
                                                        className="p-1.5 bg-blue-500 text-white shadow-sm rounded-lg hover:bg-blue-600 transition-all active:scale-95"
                                                        title="Chatten"
                                                    >
                                                        <MessageCircle size={14} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            setActiveChatFriend(friend);
                                                            setIsRequestModalOpen(true);
                                                        }}
                                                        className="p-1.5 bg-indigo-500 text-white shadow-sm rounded-lg hover:bg-indigo-600 transition-all active:scale-95"
                                                        title="Material anfragen"
                                                    >
                                                        <FileQuestion size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="p-4 border-t border-gray-100">
                <button onClick={signOut} className="flex items-center gap-2 w-full p-3 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                    <LogOut size={18} />
                    <span className="text-sm font-medium">Abmelden</span>
                </button>
            </div>
        </div>
    );

    return (
        <>
            {/* Desktop Sidebar (Fixed) */}
            <aside className="hidden md:flex flex-col w-72 border-r border-gray-100 h-screen sticky top-0 bg-white">
                <SidebarContent />
            </aside>

            {/* Mobile Sidebar (Overlay) */}
            {isOpen && (
                <div className="md:hidden fixed inset-0 z-50 flex">
                    {/* Backdrop */}
                    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose}></div>
                    {/* Drawer */}
                    <aside className="relative w-72 bg-white h-full shadow-2xl animate-in slide-in-from-left duration-200">
                        <SidebarContent />
                    </aside>
                </div>
            )}
            {/* Chat Components */}
            {activeChatFriend && (
                <ChatWindow
                    friend={activeChatFriend}
                    currentUser={user}
                    onClose={() => setActiveChatFriend(null)}
                />
            )}

            {activeChatFriend && isRequestModalOpen && (
                <MaterialRequestModal
                    friend={activeChatFriend}
                    currentUser={user}
                    onClose={() => setIsRequestModalOpen(false)}
                    onSent={() => setIsRequestModalOpen(false)}
                />
            )}
        </>
    );
}
