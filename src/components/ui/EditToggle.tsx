'use client';

import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { Pencil, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function EditToggle() {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();
    const isEditMode = searchParams.get('edit') === 'true';

    const toggleEdit = () => {
        const params = new URLSearchParams(searchParams.toString());
        if (isEditMode) {
            params.delete('edit');
        } else {
            params.set('edit', 'true');
        }
        router.push(`${pathname}?${params.toString()}`);
    };

    return (
        <button
            onClick={toggleEdit}
            className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-sm font-medium",
                isEditMode
                    ? "bg-blue-100 text-blue-600 hover:bg-blue-200"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            )}
        >
            {isEditMode ? (
                <>
                    <X size={16} />
                    <span>Fertig</span>
                </>
            ) : (
                <>
                    <Pencil size={16} />
                    <span>Bearbeiten</span>
                </>
            )}
        </button>
    );
}
