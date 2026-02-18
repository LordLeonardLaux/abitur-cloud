'use client';

import { useEffect, useState } from 'react';
import OneSignal from 'react-onesignal';
import { Capacitor } from '@capacitor/core';

const ONESIGNAL_APP_ID = '78604014-b8b1-4f95-8020-0d00fa250dbc';

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const initNotifications = async () => {
            try {
                if (Capacitor.isNativePlatform()) {
                    // iOS: OneSignal is initialized natively via AppDelegate
                    // No JS-side init needed for native platforms
                    console.log("[NotificationProvider] Native platform detected. OneSignal managed by native SDK.");
                } else {
                    // Web: Use react-onesignal
                    console.log("[NotificationProvider] Initializing OneSignal Web SDK...");
                    await OneSignal.init({
                        appId: ONESIGNAL_APP_ID,
                        allowLocalhostAsSecureOrigin: true,
                    });
                    console.log("[NotificationProvider] OneSignal Web SDK initialized.");
                }
                setIsInitialized(true);
            } catch (error) {
                console.error('[NotificationProvider] Init Error:', error);
            }
        };

        initNotifications();
    }, []);

    return <>{children}</>;
}
