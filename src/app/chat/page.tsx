'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { ChatWindow } from '@/components/dashboard/ChatWindow';
import { useAuth } from '@/contexts/AuthContext';
import { useFriends } from '@/hooks/useFriends';
import { MessageSquare, ArrowLeft, Users, BookOpen, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function ChatPage() {
    const { user } = useAuth();
    const { friends, loading, pendingRequests, suggestions } = useFriends();
    const [selectedFriend, setSelectedFriend] = useState<any>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'chat' | 'friends'>('chat');

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {/* Sidebar (Desktop only for friend list) */}
            <Sidebar
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                onChatOpen={(friend) => setSelectedFriend(friend)}
            />

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-white shadow-inner relative">
                {selectedFriend ? (
                    <ChatWindow
                        friend={selectedFriend}
                        currentUser={user}
                        onClose={() => setSelectedFriend(null)}
                        isInline={true}
                    />
                ) : (
                    <>
                        {/* Mobile: Show friends list inline */}
                        <div className="md:hidden flex flex-col h-full bg-gray-50">
                            {/* Header with Tabs */}
                            <div className="pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-0 border-b border-gray-200 bg-white sticky top-0 z-10 shadow-sm">
                                <h1 className="text-2xl font-bold text-gray-900 px-5 mb-4">Kontakte</h1>

                                <div className="flex px-5 gap-6">
                                    <button
                                        onClick={() => setActiveTab('friends')}
                                        className={cn(
                                            "pb-3 text-sm font-bold transition-all relative",
                                            activeTab === 'friends' ? "text-blue-600" : "text-gray-400 hover:text-gray-600"
                                        )}
                                    >
                                        Freunde ({friends.length})
                                        {activeTab === 'friends' && (
                                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full shadow-[0_-2px_8px_rgba(37,99,235,0.4)]" />
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('chat')}
                                        className={cn(
                                            "pb-3 text-sm font-bold transition-all relative",
                                            activeTab === 'chat' ? "text-blue-600" : "text-gray-400 hover:text-gray-600"
                                        )}
                                    >
                                        Chats
                                        {activeTab === 'chat' && (
                                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full shadow-[0_-2px_8px_rgba(37,99,235,0.4)]" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* List Content */}
                            <div className="flex-1 overflow-y-auto pb-24 p-4">
                                {loading ? (
                                    <div className="flex justify-center items-center h-40">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                                    </div>
                                ) : activeTab === 'friends' ? (
                                    /* FREUNDE TAB */
                                    friends.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center text-center p-8 mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                                                <Users size={28} className="text-blue-400" />
                                            </div>
                                            <h3 className="text-lg font-bold text-gray-900 mb-1">Noch keine Freunde</h3>
                                            <p className="text-sm text-gray-400 max-w-xs">Füge Freunde über die Suchleiste hinzu.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {/* We can sort friends here if we had class data, right now just map them */}
                                            {friends.map((friend) => {
                                                const isTeacher = (friend as any).role === 'teacher';
                                                return (
                                                    <div key={friend.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col gap-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn(
                                                                "w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-inner",
                                                                isTeacher ? "bg-gradient-to-br from-amber-400 to-amber-600" : "bg-gradient-to-br from-blue-400 to-indigo-500"
                                                            )}>
                                                                {friend.full_name?.charAt(0)}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[16px] font-bold text-gray-900 truncate">{friend.full_name}</p>
                                                                {isTeacher ? (
                                                                    <p className="text-[12px] font-semibold text-amber-500 mt-0.5">Lehrkraft</p>
                                                                ) : (
                                                                    <p className="text-[12px] font-medium text-gray-400 mt-0.5">@{friend.username || 'Schüler'}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {/* Action Buttons */}
                                                        <div className="flex gap-2 pt-1">
                                                            <Link href={`/profile?id=${friend.id}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors font-semibold text-xs active:scale-95">
                                                                <BookOpen size={14} /> Material
                                                            </Link>
                                                            <button onClick={() => { setActiveTab('chat'); setSelectedFriend(friend); }} className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors font-semibold text-xs active:scale-95">
                                                                <HelpCircle size={14} /> Frage
                                                            </button>
                                                            <button onClick={() => { setActiveTab('chat'); setSelectedFriend(friend); }} className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100 transition-colors font-semibold text-xs active:scale-95">
                                                                <MessageSquare size={14} /> Chat
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )
                                ) : (
                                    /* CHAT TAB */
                                    friends.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center text-center p-8 mt-4">
                                            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                                                <MessageSquare size={28} className="text-gray-300" />
                                            </div>
                                            <h3 className="text-lg font-bold text-gray-900 mb-1">Keine aktiven Chats</h3>
                                            <p className="text-sm text-gray-400 max-w-xs">Gehe zu deinen Freunden, um einen Chat zu starten.</p>
                                        </div>
                                    ) : (
                                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
                                            {friends.map((friend) => {
                                                const isTeacher = (friend as any).role === 'teacher';
                                                return (
                                                    <button
                                                        key={friend.id}
                                                        onClick={() => setSelectedFriend(friend)}
                                                        className="w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
                                                    >
                                                        <div className={cn(
                                                            "w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 relative",
                                                            isTeacher ? "bg-gradient-to-br from-amber-400 to-amber-600" : "bg-gradient-to-br from-blue-400 to-indigo-500"
                                                        )}>
                                                            {friend.full_name?.charAt(0)}
                                                            {/* Placeholder for unread badge if needed */}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-baseline mb-0.5">
                                                                <p className="text-[15px] font-bold text-gray-900 truncate">{friend.full_name}</p>
                                                                <p className="text-[10px] text-gray-400 font-medium">Neu</p>
                                                            </div>
                                                            <p className="text-[13px] text-gray-500 truncate">Klicke hier, um den Chat zu öffnen...</p>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )
                                )}
                            </div>
                        </div>

                        {/* Desktop: Show centered empty state */}
                        <div className="hidden md:flex flex-1 flex-col items-center justify-center text-gray-400 p-8 text-center bg-gray-50">
                            <div className="w-20 h-20 bg-white rounded-3xl shadow-sm border border-gray-100 flex items-center justify-center mb-6">
                                <MessageSquare size={40} className="text-blue-500" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Deine Chats</h2>
                            <p className="max-w-xs mx-auto">Wähle einen Freund aus der Sidebar links aus, um eine Unterhaltung zu beginnen.</p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
