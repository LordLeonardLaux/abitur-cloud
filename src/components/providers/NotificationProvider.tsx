'use client';

import { useEffect, useState } from 'react';
import OneSignalWeb from 'react-onesignal';
import OneSignalNative from 'onesignal-cordova-plugin';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/lib/platform';

const ONESIGNAL_APP_ID = '78604014-b8b1-4f95-8020-0d00fa250dbc';

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const { user, profile } = useAuth();
    const [isInitialized, setIsInitialized] = useState(false);

    // Initial Setup
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const initNotifications = async () => {
            try {
                if (Capacitor.isNativePlatform()) {
                    console.log("[NotificationProvider] Initializing Native OneSignal...");
                    // Native Init
                    OneSignalNative.initialize(ONESIGNAL_APP_ID);

                    // Permission Prompt
                    let accepted = await OneSignalNative.Notifications.requestPermission(true);
                    console.log("[NotificationProvider] Native Permission:", accepted);
                } else {
                    // Web Init
                    console.log("[NotificationProvider] Initializing Web OneSignal...");
                    await OneSignalWeb.init({
                        appId: ONESIGNAL_APP_ID,
                        allowLocalhostAsSecureOrigin: true,
                    });
                }
                setIsInitialized(true);
            } catch (error) {
                console.error('[NotificationProvider] Init Error:', error);
            }
        };

        initNotifications();
    }, []);

    // User Identification & Tagging (Runs when user/profile changes)
    useEffect(() => {
        if (!isInitialized || !user || !profile) return;

        const updateTags = async () => {
            try {
                const isNative = Capacitor.isNativePlatform();
                const OneSignal = isNative ? OneSignalNative : OneSignalWeb;

                // 1. Login User
                // Native: OneSignal.login(externalId)
                // Web: OneSignal.login(externalId)
                if (isNative) {
                    OneSignalNative.login(user.id);
                } else {
                    await OneSignalWeb.login(user.id);
                }

                // 2. Fetch Subjects and Set Tags
                // We need the token to fetch subjects
                const getSession = async () => {
                    // Try to get token from storage as SDK might be slow
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key?.startsWith('sb-') && key?.endsWith('-auth-token')) {
                            const item = localStorage.getItem(key);
                            if (item) return JSON.parse(item).access_token;
                        }
                    }
                    return null;
                };

                const token = await getSession();
                if (!token) return; // Should not happen if user is logged in

                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_subjects?user_id=eq.${user.id}`,
                    {
                        headers: {
                            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                            'Authorization': `Bearer ${token}`,
                        }
                    }
                );

                const tags: Record<string, string> = {
                    role: profile.role || 'student',
                    grade: profile.grade_level || 'none'
                };

                if (res.ok) {
                    const subjects = await res.json();
                    subjects.forEach((s: any) => {
                        // Tag: subject_<id> = "LK" / "GK" / "m"
                        tags[`subject_${s.subject_id}`] = s.subject_type || 'true';
                    });
                }

                console.log("[NotificationProvider] Setting Tags:", tags);

                if (isNative) {
                    OneSignalNative.User.addTags(tags);
                } else {
                    OneSignalWeb.User.addTags(tags);
                }

            } catch (e) {
                console.error("[NotificationProvider] Tagging Error:", e);
            }
        };

        updateTags();
    }, [isInitialized, user, profile]);

    return <>{children}</>;
}
