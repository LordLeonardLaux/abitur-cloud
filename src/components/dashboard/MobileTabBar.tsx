'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, MessageCircle, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
    { href: '/dashboard', label: 'Übersicht', icon: LayoutGrid },
    { href: '/chat', label: 'Chat', icon: MessageCircle },
    { href: '/materials', label: 'Kalender', icon: Calendar },
] as const;

export function MobileTabBar() {
    const pathname = usePathname();

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-t border-gray-100 pb-[env(safe-area-inset-bottom,0px)]">
            <div className="flex items-stretch justify-around h-16">
                {tabs.map((tab) => {
                    const isActive = pathname === tab.href || pathname?.startsWith(tab.href + '/');
                    const Icon = tab.icon;
                    return (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            className={cn(
                                "flex flex-col items-center justify-center flex-1 gap-0.5 transition-colors relative",
                                isActive
                                    ? "text-blue-600"
                                    : "text-gray-400 active:text-gray-600"
                            )}
                        >
                            {isActive && (
                                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-full" />
                            )}
                            <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                            <span className={cn(
                                "text-[10px] tracking-wide",
                                isActive ? "font-bold" : "font-medium"
                            )}>
                                {tab.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
