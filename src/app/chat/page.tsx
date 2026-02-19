'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { ChatWindow } from '@/components/dashboard/ChatWindow';
import { useAuth } from '@/contexts/AuthContext';
import { useFriends } from '@/hooks/useFriends';
import { MessageSquare, ArrowLeft, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ChatPage() {
    const { user } = useAuth();
    const { friends, loading } = useFriends();
    const [selectedFriend, setSelectedFriend] = useState<any>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
                        <div className="md:hidden flex flex-col h-full">
                            {/* Header */}
                            <div className="px-5 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-4 border-b border-gray-100 bg-white">
                                <h1 className="text-2xl font-bold text-gray-900">Chats</h1>
                                <p className="text-sm text-gray-400 mt-0.5">{friends.length} Freunde</p>
                            </div>

                            {/* Friends List */}
                            <div className="flex-1 overflow-y-auto pb-24">
                                {loading ? (
                                    <div className="flex justify-center items-center h-40">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                                    </div>
                                ) : friends.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center text-center p-8 mt-12">
                                        <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                                            <Users size={28} className="text-gray-300" />
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-900 mb-1">Noch keine Freunde</h3>
                                        <p className="text-sm text-gray-400 max-w-xs">Füge Freunde über die Suchleiste in der Sidebar hinzu, um mit ihnen zu chatten.</p>
                                        <button
                                            onClick={() => setIsSidebarOpen(true)}
                                            className="mt-6 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-all"
                                        >
                                            Freunde suchen
                                        </button>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-50">
                                        {friends.map((friend) => {
                                            const isTeacher = (friend as any).role === 'teacher';
                                            return (
                                                <button
                                                    key={friend.id}
                                                    onClick={() => setSelectedFriend(friend)}
                                                    className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
                                                >
                                                    <div className={cn(
                                                        "w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0",
                                                        isTeacher
                                                            ? "bg-gradient-to-br from-amber-400 to-amber-600 ring-2 ring-amber-400 ring-offset-2"
                                                            : "bg-blue-500"
                                                    )}>
                                                        {friend.full_name?.charAt(0)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[15px] font-semibold text-gray-900 truncate">{friend.full_name}</p>
                                                        {isTeacher && (
                                                            <p className="text-[11px] font-medium text-amber-500 mt-0.5">Lehrer</p>
                                                        )}
                                                    </div>
                                                    <MessageSquare size={18} className="text-gray-300 flex-shrink-0" />
                                                </button>
                                            );
                                        })}
                                    </div>
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
