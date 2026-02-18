'use client';

import { Menu } from 'lucide-react';
import { TaskHub } from './TaskHub';

interface MobileHeaderProps {
    onMenuClick: () => void;
}

export function MobileHeader({ onMenuClick }: MobileHeaderProps) {
    return (
        <header className="md:hidden flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 sticky top-0 z-40 pt-[calc(1.5rem+var(--safe-area-inset-top,0px))]">
            <h1 className="text-xl font-black text-gray-900 tracking-tight">Abitur Cloud</h1>
            <div className="flex items-center gap-1">
                {/* Task Hub */}
                <TaskHub />

                {/* Menu Button */}
                <button
                    onClick={onMenuClick}
                    className="p-2 hover:bg-gray-50 rounded-lg"
                >
                    <Menu size={24} className="text-gray-900" />
                </button>
            </div>
        </header>
    );
}
