'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { ChatWindow } from '@/components/dashboard/ChatWindow';
import { useAuth } from '@/contexts/AuthContext';
import { MessageSquare } from 'lucide-react';

export default function ChatPage() {
    const { user } = useAuth();
    const [selectedFriend, setSelectedFriend] = useState<any>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {/* Sidebar (Friend List) */}
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
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center bg-gray-50">
                        <div className="w-20 h-20 bg-white rounded-3xl shadow-sm border border-gray-100 flex items-center justify-center mb-6">
                            <MessageSquare size={40} className="text-blue-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Deine Chats</h2>
                        <p className="max-w-xs mx-auto">Wähle einen Freund aus der Sidebar links aus, um eine Unterhaltung zu beginnen.</p>
                        
                        {/* Mobile Toggle Info */}
                        <button 
                            onClick={() => setIsSidebarOpen(true)}
                            className="md:hidden mt-8 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-all"
                        >
                            Freunde anzeigen
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
