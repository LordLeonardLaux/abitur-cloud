/**
 * Rank System
 * ===========
 * Defines ranks, XP thresholds, and styling for the gamification system.
 */

export interface Rank {
    name: string;
    minXp: number;
    color: string;        // Solid color for the border
    gradient?: string;    // Optional gradient for special ranks
    bgColor: string;      // Background color for badges
    textColor: string;    // Text color for badges
    emoji: string;
}

export const RANKS: Rank[] = [
    {
        name: 'Neuling',
        minXp: 0,
        color: '#9CA3AF',
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-600',
        emoji: '🌱',
    },
    {
        name: 'Sidekick',
        minXp: 10,
        color: '#3B82F6',
        bgColor: 'bg-blue-100',
        textColor: 'text-blue-700',
        emoji: '🤝',
    },
    {
        name: 'Streber',
        minXp: 50,
        color: '#22C55E',
        bgColor: 'bg-green-100',
        textColor: 'text-green-700',
        emoji: '🤓',
    },
    {
        name: 'Legende',
        minXp: 150,
        color: '#F59E0B',
        gradient: 'linear-gradient(135deg, #F59E0B, #EF4444)',
        bgColor: 'bg-gradient-to-r from-amber-100 to-red-100',
        textColor: 'text-amber-700',
        emoji: '👑',
    },
    {
        name: 'Steinersgeist',
        minXp: 500,
        color: '#A855F7',
        gradient: 'linear-gradient(135deg, #A855F7, #6366F1)',
        bgColor: 'bg-purple-100',
        textColor: 'text-purple-700',
        emoji: '👻',
    },
    {
        name: 'Meister Steffen',
        minXp: 1000,
        color: '#EC4899',
        gradient: 'linear-gradient(135deg, #EC4899, #8B5CF6, #3B82F6)',
        bgColor: 'bg-gradient-to-r from-pink-100 to-blue-100',
        textColor: 'text-pink-700',
        emoji: '🧙‍♂️',
    },
];

/**
 * Get the current rank for a given XP amount.
 */
export function getRank(xp: number): Rank {
    for (let i = RANKS.length - 1; i >= 0; i--) {
        if (xp >= RANKS[i].minXp) return RANKS[i];
    }
    return RANKS[0];
}

/**
 * Get the next rank and progress towards it.
 */
export function getNextRank(xp: number): { nextRank: Rank | null; xpNeeded: number; progress: number } {
    const currentRank = getRank(xp);
    const currentIndex = RANKS.indexOf(currentRank);

    if (currentIndex >= RANKS.length - 1) {
        return { nextRank: null, xpNeeded: 0, progress: 100 };
    }

    const nextRank = RANKS[currentIndex + 1];
    const xpInCurrentLevel = xp - currentRank.minXp;
    const xpForNextLevel = nextRank.minXp - currentRank.minXp;
    const progress = Math.min(100, Math.round((xpInCurrentLevel / xpForNextLevel) * 100));

    return {
        nextRank,
        xpNeeded: nextRank.minXp - xp,
        progress,
    };
}

/**
 * Get avatar border style based on rank.
 * Returns inline CSS style object.
 */
export function getAvatarBorderStyle(xp: number, rankVisible: boolean): React.CSSProperties {
    if (!rankVisible) return {};

    const rank = getRank(xp);
    if (rank.gradient) {
        return {
            border: '3px solid transparent',
            backgroundImage: rank.gradient,
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box',
        };
    }

    return {
        border: `3px solid ${rank.color}`,
    };
}

/**
 * Get avatar wrapper style (for gradient border trick).
 * Use this as an outer wrapper around the avatar div.
 */
export function getAvatarWrapperStyle(xp: number, rankVisible: boolean): React.CSSProperties {
    if (!rankVisible || xp < RANKS[1].minXp) return {};

    const rank = getRank(xp);
    if (rank.gradient) {
        return {
            background: rank.gradient,
            padding: '3px',
            borderRadius: '9999px',
        };
    }

    return {
        border: `3px solid ${rank.color}`,
        borderRadius: '9999px',
    };
}
