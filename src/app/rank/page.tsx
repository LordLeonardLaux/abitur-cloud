'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { RANKS, getRank, getNextRank, getAvatarWrapperStyle } from '@/lib/ranks';
import { getLeaderboard } from '@/services/xpService';
import {
    ChevronLeft, Trophy, Star, Crown,
    Zap, TrendingUp, Medal
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeaderboardEntry {
    id: string;
    full_name: string;
    username: string;
    xp: number;
}

export default function RankPage() {
    const router = useRouter();
    const { user, profile } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const xp = profile?.xp || 0;
    const currentRank = getRank(xp);
    const { nextRank, xpNeeded, progress } = getNextRank(xp);

    useEffect(() => {
        getLeaderboard(10).then(data => {
            setLeaderboard(data);
            setLoading(false);
        });
    }, []);

    const getMedalIcon = (index: number) => {
        if (index === 0) return <Crown className="w-5 h-5 text-amber-500" />;
        if (index === 1) return <Medal className="w-5 h-5 text-gray-400" />;
        if (index === 2) return <Medal className="w-5 h-5 text-amber-700" />;
        return <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-gray-400">{index + 1}</span>;
    };

    return (
        <main className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-2xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between gap-4 px-2">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/dashboard/')} className="p-2 -ml-2 rounded-full hover:bg-gray-200">
                            <ChevronLeft className="w-6 h-6 text-gray-600" />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                                <Trophy className="w-5 h-5 text-purple-600" />
                            </div>
                            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Mein Rang</h1>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="md:hidden p-2 bg-white border border-gray-100 shadow-sm rounded-xl text-gray-900 active:scale-95"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                    </button>
                </div>

                {/* Current Rank Card */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-8 text-center">
                        {/* Avatar with rank border */}
                        <div className="inline-block mb-4" style={getAvatarWrapperStyle(xp, true)}>
                            <div className="w-24 h-24 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-3xl">
                                {profile?.full_name?.charAt(0) || '?'}
                            </div>
                        </div>

                        <div className="text-4xl mb-2">{currentRank.emoji}</div>
                        <h2 className="text-2xl font-black" style={{ color: currentRank.color }}>
                            {currentRank.name}
                        </h2>
                        <p className="text-gray-500 mt-1 font-medium">{profile?.full_name}</p>

                        {/* XP Counter */}
                        <div className="mt-6 flex items-center justify-center gap-2">
                            <Zap className="w-5 h-5 text-amber-500" />
                            <span className="text-3xl font-black text-gray-900">{xp}</span>
                            <span className="text-gray-400 font-medium">XP</span>
                        </div>

                        {/* Progress to next rank */}
                        {nextRank && (
                            <div className="mt-6 max-w-xs mx-auto">
                                <div className="flex justify-between text-xs text-gray-400 mb-2">
                                    <span>{currentRank.emoji} {currentRank.name}</span>
                                    <span>{nextRank.emoji} {nextRank.name}</span>
                                </div>
                                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-1000 ease-out"
                                        style={{
                                            width: `${progress}%`,
                                            background: nextRank.gradient || nextRank.color,
                                        }}
                                    />
                                </div>
                                <p className="text-xs text-gray-400 mt-2">
                                    Noch <span className="font-bold text-gray-600">{xpNeeded} XP</span> bis {nextRank.emoji} {nextRank.name}
                                </p>
                            </div>
                        )}

                        {!nextRank && (
                            <p className="mt-4 text-amber-600 font-bold flex items-center justify-center gap-2">
                                <Crown className="w-5 h-5" />
                                Höchster Rang erreicht!
                            </p>
                        )}
                    </div>

                    {/* XP Sources */}
                    <div className="border-t border-gray-100 p-6">
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">So verdienst du XP</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-3 bg-blue-50 rounded-xl p-3">
                                <TrendingUp className="w-5 h-5 text-blue-600 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-bold text-blue-700">+5 XP</p>
                                    <p className="text-xs text-blue-500">pro Upload</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 bg-green-50 rounded-xl p-3">
                                <Star className="w-5 h-5 text-green-600 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-bold text-green-700">+3 XP</p>
                                    <p className="text-xs text-green-500">pro Nützlich-Vote</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* All Ranks */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Star className="w-5 h-5 text-amber-500" />
                            Alle Ränge
                        </h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {RANKS.map((rank, i) => {
                            const isCurrentRank = rank.name === currentRank.name;
                            const isUnlocked = xp >= rank.minXp;
                            return (
                                <div
                                    key={rank.name}
                                    className={cn(
                                        "flex items-center justify-between px-6 py-4 transition-colors",
                                        isCurrentRank && "bg-purple-50/50",
                                        !isUnlocked && "opacity-40"
                                    )}
                                >
                                    <div className="flex items-center gap-4">
                                        <span className="text-2xl">{rank.emoji}</span>
                                        <div>
                                            <p className={cn("font-bold", isCurrentRank ? "text-purple-700" : "text-gray-900")}>
                                                {rank.name}
                                                {isCurrentRank && <span className="ml-2 text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">Aktuell</span>}
                                            </p>
                                            <p className="text-xs text-gray-400">ab {rank.minXp} XP</p>
                                        </div>
                                    </div>
                                    <div
                                        className="w-8 h-8 rounded-full border-[3px]"
                                        style={{
                                            borderColor: rank.color,
                                            background: isUnlocked ? rank.color + '20' : 'transparent',
                                        }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Leaderboard */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Trophy className="w-5 h-5 text-amber-500" />
                            Rangliste
                        </h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {loading ? (
                            <div className="p-8 text-center text-gray-400">Lade Rangliste...</div>
                        ) : leaderboard.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">
                                <p className="font-medium">Noch keine Einträge</p>
                                <p className="text-sm mt-1">Lade Materialien hoch, um XP zu sammeln!</p>
                            </div>
                        ) : (
                            leaderboard.map((entry, i) => {
                                const entryRank = getRank(entry.xp);
                                const isMe = entry.id === user?.id;
                                return (
                                    <div
                                        key={entry.id}
                                        className={cn(
                                            "flex items-center justify-between px-6 py-4",
                                            isMe && "bg-blue-50/50"
                                        )}
                                    >
                                        <div className="flex items-center gap-4">
                                            {getMedalIcon(i)}
                                            <div style={getAvatarWrapperStyle(entry.xp, true)}>
                                                <div
                                                    className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
                                                    style={{ background: `linear-gradient(135deg, ${entryRank.color}88, ${entryRank.color})` }}
                                                >
                                                    {entry.full_name?.charAt(0)}
                                                </div>
                                            </div>
                                            <div>
                                                <p className={cn("font-bold text-sm", isMe ? "text-blue-700" : "text-gray-900")}>
                                                    {entry.full_name}
                                                    {isMe && <span className="ml-1 text-xs text-blue-500">(Du)</span>}
                                                </p>
                                                <p className="text-xs text-gray-400">{entryRank.emoji} {entryRank.name}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-gray-900">{entry.xp}</p>
                                            <p className="text-xs text-gray-400">XP</p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        </main>
    );
}
