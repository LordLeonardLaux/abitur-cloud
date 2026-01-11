'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SUBJECTS, SUBJECT_COLORS } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { Profile } from '@/lib/types';
import { LogOut, Users, Search, ChevronRight, BookOpen, Calendar } from 'lucide-react';
import { GradeMigrationModal } from '@/components/GradeMigrationModal';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
    const { user, profile, signOut } = useAuth();
    const [friends, setFriends] = useState<Profile[]>([]);
    const [friendSubjects, setFriendSubjects] = useState<Record<string, Record<string, string>>>({}); // userId -> { subjectId -> type }
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Profile[]>([]);
    const [searching, setSearching] = useState(false);
    const [sentRequests, setSentRequests] = useState<string[]>([]); // IDs of users we've sent requests to
    const [suggestions, setSuggestions] = useState<Profile[]>([]); // Suggested friends

    const [userSubjects, setUserSubjects] = useState<Record<string, string>>({}); // subjectId -> type
    const [loadingSubjects, setLoadingSubjects] = useState(true);

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


    // Helper: Read token directly from localStorage (bypasses hanging SDK)
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
            console.error("Error reading token from localStorage:", e);
        }
        return null;
    };

    // Fetch accepted friends using raw fetch
    useEffect(() => {
        const fetchFriends = async () => {
            if (!user) return;
            const token = getTokenFromLocalStorage();
            if (!token) return;

            try {
                // Get friendships where status = 'accepted' and we are either user_id or friend_id
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/friendships?or=(user_id.eq.${user.id},friend_id.eq.${user.id})&status=eq.accepted`,
                    {
                        headers: {
                            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                            'Authorization': `Bearer ${token}`,
                        }
                    }
                );
                if (res.ok) {
                    const friendships = await res.json();

                    if (friendships && friendships.length > 0) {
                        const friendIds = friendships.map((f: any) => f.user_id === user.id ? f.friend_id : f.user_id);

                        // Fetch profiles of friends
                        const profilesRes = await fetchProfiles(friendIds, token);
                        if (profilesRes.ok) {
                            const profiles = await profilesRes.json();
                            setFriends(profiles);

                            // Fetch subjects for each friend
                            const subjectsRes = await fetch(
                                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_subjects?user_id=in.(${friendIds.join(',')})`,
                                {
                                    headers: {
                                        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                                        'Authorization': `Bearer ${token}`,
                                    }
                                }
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

                        // Fetch Suggestions (Users in same grade, not friends)
                        if (profile && profile.grade_level) {
                            const { data: suggestedUsers } = await supabase
                                .from('profiles')
                                .select('*')
                                .eq('grade_level', profile.grade_level)
                                .neq('id', profile.id)
                                .not('id', 'in', `(${friendIds.join(',')})`)
                                .limit(10);

                            if (suggestedUsers) {
                                setSuggestions(suggestedUsers.slice(0, 3));
                            }
                        }
                    } else {
                        setFriends([]);
                        setSuggestions([]);
                    }
                }
            } catch (e) {
                console.error("Failed to fetch friends:", e);
            }
        };

        const fetchPendingRequests = async () => {
            if (!user) return;
            const token = getTokenFromLocalStorage();
            if (!token) return;

            try {
                // Get pending requests
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/friendships?friend_id=eq.${user.id}&status=eq.pending`,
                    {
                        headers: {
                            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                            'Authorization': `Bearer ${token}`,
                        }
                    }
                );
                if (res.ok) {
                    const requests = await res.json();
                    if (requests.length > 0) {
                        const requesterIds = requests.map((r: any) => r.user_id);
                        const profilesRes = await fetch(
                            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?id=in.(${requesterIds.join(',')})`,
                            {
                                headers: {
                                    'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                                    'Authorization': `Bearer ${token}`,
                                }
                            }
                        );
                        if (profilesRes.ok) {
                            const profiles = await profilesRes.json();
                            // Merge profile info with request info
                            const merged = requests.map((r: any) => ({
                                ...r,
                                profile: profiles.find((p: any) => p.id === r.user_id)
                            }));
                            setPendingRequests(merged);
                            console.log("Loaded pending requests:", merged);
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to fetch pending requests:", e);
            }
        };

        fetchFriends();
        fetchPendingRequests();
    }, [user]);

    // Fetch user subjects using raw fetch
    useEffect(() => {
        async function loadUserSubjects() {
            if (!user) return;
            const token = getTokenFromLocalStorage();
            if (!token) {
                setLoadingSubjects(false);
                return;
            }

            try {
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_subjects?user_id=eq.${user.id}`,
                    {
                        headers: {
                            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                            'Authorization': `Bearer ${token}`,
                        }
                    }
                );
                if (res.ok) {
                    const data = await res.json();
                    const map: Record<string, string> = {};
                    data.forEach((s: any) => {
                        map[s.subject_id] = s.subject_type;
                    });
                    setUserSubjects(map);
                    console.log("Loaded subjects:", map);
                }
            } catch (e) {
                console.error("Failed to load subjects:", e);
            } finally {
                setLoadingSubjects(false);
            }
        }
        loadUserSubjects();
    }, [user]);

    // Search for users using raw fetch
    const handleSearch = async () => {
        if (!searchQuery.trim() || !user) return;
        setSearching(true);
        const token = getTokenFromLocalStorage();
        if (!token) {
            setSearching(false);
            return;
        }

        try {
            // Search by username, full_name, or email using OR syntax
            const query = encodeURIComponent(searchQuery);
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?or=(username.ilike.*${query}*,full_name.ilike.*${query}*,email.ilike.*${query}*)&id=neq.${user.id}&limit=10`,
                {
                    headers: {
                        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                        'Authorization': `Bearer ${token}`,
                    }
                }
            );
            if (res.ok) {
                const data = await res.json();
                setSearchResults(data);
                console.log("Search results:", data);
            } else {
                console.error("Search error:", res.status, await res.text());
            }
        } catch (e) {
            console.error("Search failed:", e);
        } finally {
            setSearching(false);
        }
    };

    // Send friend request
    const sendFriendRequest = async (friendId: string) => {
        if (!user) return;
        const token = getTokenFromLocalStorage();
        if (!token) return;

        try {
            // First check if any friendship already exists (in either direction)
            const checkRes = await fetch(
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/friendships?or=(and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id}))`,
                {
                    headers: {
                        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                        'Authorization': `Bearer ${token}`,
                    }
                }
            );

            if (checkRes.ok) {
                const existing = await checkRes.json();
                if (existing.length > 0) {
                    const existingRequest = existing[0];
                    // If THEY sent us a request, auto-accept it
                    if (existingRequest.user_id === friendId && existingRequest.status === 'pending') {
                        console.log("Reverse request exists, accepting it...");
                        await acceptRequest(existingRequest.id);
                        return;
                    }
                    // Otherwise, request already exists
                    console.log("Friendship already exists:", existingRequest);
                    setSentRequests(prev => [...prev, friendId]);
                    return;
                }
            }

            // No existing friendship, create new request
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
                    body: JSON.stringify({
                        user_id: user.id,
                        friend_id: friendId,
                        status: 'pending'
                    })
                }
            );
            if (res.ok) {
                console.log("Friend request sent to:", friendId);
                setSentRequests(prev => [...prev, friendId]);
            } else {
                const errorText = await res.text();
                console.error("Failed to send request:", res.status, errorText);
                // Still mark as sent to prevent UI confusion
                if (res.status === 409) {
                    setSentRequests(prev => [...prev, friendId]);
                }
            }
        } catch (e) {
            console.error("Error sending friend request:", e);
        }
    };

    // Accept friend request
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
            if (res.ok) {
                console.log("Request accepted:", requestId);
                // Refresh the page to update friends list
                window.location.reload();
            }
        } catch (e) {
            console.error("Error accepting request:", e);
        }
    };

    // Reject friend request
    const rejectRequest = async (requestId: string) => {
        const token = getTokenFromLocalStorage();
        if (!token) return;

        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/friendships?id=eq.${requestId}`,
                {
                    method: 'DELETE',
                    headers: {
                        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                        'Authorization': `Bearer ${token}`,
                        'Prefer': 'return=minimal'
                    }
                }
            );
            if (res.ok) {
                console.log("Request rejected:", requestId);
                setPendingRequests(prev => prev.filter(r => r.id !== requestId));
            }
        } catch (e) {
            console.error("Error rejecting request:", e);
        }
    };

    // Filter subjects based on user selection
    const displayedSubjects = SUBJECTS.filter(s => !!userSubjects[s.id]);
    const hasSubjects = Object.keys(userSubjects).length > 0;

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {profile && <GradeMigrationModal user={profile} onUpdate={(g) => window.location.reload()} />}
            {/* Sidebar */}
            <aside className="w-72 bg-white border-r border-gray-100 flex flex-col h-screen sticky top-0">
                <div className="p-6 border-b border-gray-100">
                    <h1 className="text-xl font-bold text-gray-900">Abitur Cloud</h1>
                    <p className="text-sm text-gray-500 mt-1">Hallo, {profile?.full_name || 'User'}!</p>
                </div>

                {/* Friend Search */}
                <div className="p-4 border-b border-gray-100">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Freunde suchen..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            onClick={handleSearch}
                            className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                            <Search size={18} />
                        </button>
                    </div>
                    {searchResults.length > 0 && (
                        <div className="mt-2 bg-gray-50 rounded-lg p-2 space-y-1">
                            {searchResults.map((p) => {
                                const alreadySent = sentRequests.includes(p.id);
                                const alreadyFriend = friends.some(f => f.id === p.id);
                                return (
                                    <div
                                        key={p.id}
                                        className="flex items-center gap-2 p-2 hover:bg-white rounded-lg transition-colors"
                                    >
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
                                            <button
                                                onClick={() => sendFriendRequest(p.id)}
                                                className="text-xs bg-blue-500 text-white px-2 py-1 rounded-lg hover:bg-blue-600 transition-colors"
                                            >
                                                + Anfrage
                                            </button>
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
                        <h3 className="flex items-center gap-2 text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">
                            <Users size={14} />
                            Anfragen ({pendingRequests.length})
                        </h3>
                        <div className="space-y-2">
                            {pendingRequests.map((req) => (
                                <div key={req.id} className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg">
                                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold text-xs">
                                        {req.profile?.full_name?.charAt(0) || '?'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate">{req.profile?.full_name}</p>
                                    </div>
                                    <button
                                        onClick={() => acceptRequest(req.id)}
                                        className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600"
                                    >
                                        ✓
                                    </button>
                                    <button
                                        onClick={() => rejectRequest(req.id)}
                                        className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                                    >
                                        ✕
                                    </button>
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
                            Vorschläge (Klasse {profile?.grade_level})
                        </h3>
                        <div className="space-y-2">
                            {suggestions.map((p) => {
                                const alreadySent = sentRequests.includes(p.id);
                                return (
                                    <div key={p.id} className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">
                                            {p.full_name?.charAt(0) || '?'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-800 truncate">{p.full_name}</p>
                                        </div>
                                        {alreadySent ? (
                                            <span className="text-[10px] text-gray-400">Gesendet</span>
                                        ) : (
                                            <button
                                                onClick={() => sendFriendRequest(p.id)}
                                                className="text-xs bg-white border border-blue-200 text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                                            >
                                                +
                                            </button>
                                        )}
                                    </div>
                                )
                            })}
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
                            const gradeFriends = friends.filter(f => f.grade_level === grade || (!f.grade_level && grade === '12')); // Default to 12 if unknown, or just group unknowns
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
                                                <Link
                                                    key={friend.id}
                                                    href={`/profile?id=${friend.id}`}
                                                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                                                >
                                                    <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                                        {friend.full_name?.charAt(0) || '?'}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-gray-800 truncate">{friend.full_name}</p>
                                                        {subjectTags.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                {subjectTags.slice(0, 4).map((tag, i) => (
                                                                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                                                                        {tag}
                                                                    </span>
                                                                ))}
                                                                {subjectTags.length > 4 && (
                                                                    <span className="text-[10px] text-gray-400">+{subjectTags.length - 4}</span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-gray-500 truncate">@{friend.username}</p>
                                                        )}
                                                    </div>
                                                    <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                        {friends.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Noch keine Freunde.</p>}
                    </div>
                </div>

                {/* Logout */}
                <div className="p-4 border-t border-gray-100">
                    <button
                        onClick={signOut}
                        className="flex items-center gap-2 w-full p-3 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                    >
                        <LogOut size={18} />
                        <span className="text-sm font-medium">Abmelden</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8">
                <div className="max-w-5xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">Meine Fächer</h2>
                        <Link
                            href="/subjects/selection"
                            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                        >
                            Fächer bearbeiten
                        </Link>
                    </div>

                    {!hasSubjects && !loadingSubjects ? (
                        <div className="bg-white p-10 rounded-2xl border border-gray-100 shadow-sm text-center">
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">Keine Fächer ausgewählt</h3>
                            <p className="text-gray-500 mb-6">Wähle deine Kurse aus, um zu starten.</p>
                            <Link
                                href="/subjects/selection"
                                className="inline-block bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-500 transition-colors"
                            >
                                Jetzt Fächer wählen
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {displayedSubjects.map((subject) => {
                                const colorClass = "bg-blue-500"; // All same color
                                const typeLabel = userSubjects[subject.id];
                                return (
                                    <Link
                                        key={subject.id}
                                        href={`/subject?id=${subject.id}`}
                                        className="group relative bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg hover:border-gray-200 transition-all"
                                    >
                                        <div className={cn("w-3 h-3 rounded-full mb-4", colorClass)}></div>
                                        <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                                            {subject.name}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-xs font-bold uppercase">
                                                {typeLabel}
                                            </span>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}

                    {/* Quick Access Tiles - Below Subjects */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                        <Link href="/exams" className="group relative overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all">
                            <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 rounded-full bg-white/10 blur-2xl"></div>
                            <div className="relative z-10 flex flex-col h-full justify-between text-white">
                                <BookOpen className="w-8 h-8 mb-4 opacity-90" />
                                <div>
                                    <h3 className="text-lg font-bold">Alt-Klausuren 📚</h3>
                                    <p className="text-indigo-100 text-xs mt-1">Stöbern & Teilen</p>
                                </div>
                            </div>
                        </Link>
                        <Link href="/materials" className="group relative overflow-hidden bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all">
                            <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 rounded-full bg-white/10 blur-2xl"></div>
                            <div className="relative z-10 flex flex-col h-full justify-between text-white">
                                <Calendar className="w-8 h-8 mb-4 opacity-90" />
                                <div>
                                    <h3 className="text-lg font-bold">Unterrichtsmaterial 📅</h3>
                                    <p className="text-emerald-100 text-xs mt-1">Smartboard-Mitschriften</p>
                                </div>
                            </div>
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    );
}
