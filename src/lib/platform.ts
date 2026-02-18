import { Capacitor } from '@capacitor/core';

/**
 * Utility to detect the current running platform.
 */
export const isMobile = () => {
    return Capacitor.isNativePlatform();
};

export const getPlatform = () => {
    return Capacitor.getPlatform();
};

/**
 * Checks if AI features should be visible.
 * On desktop they are always visible.
 * On mobile they are visible only if NEXT_PUBLIC_ENABLE_MOBILE_AI is 'true'.
 */
export const showAIFeatures = () => {
    if (!isMobile()) return true;
    return process.env.NEXT_PUBLIC_ENABLE_MOBILE_AI === 'true';
};

/**
 * Returns an absolute URL for API calls on mobile, or relative on web.
 */
export const getApiUrl = (path: string) => {
    if (isMobile()) {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://api.abiturcloud.com';
        return `${baseUrl}${path}`;
    }
    return path;
};
