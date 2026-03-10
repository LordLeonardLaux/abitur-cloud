'use client';

import { useEffect, useState } from 'react';
import OneSignal from 'react-onesignal';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabase/client';
import NativeOneSignal from '@/lib/NativeOneSignal';

const ONESIGNAL_APP_ID = '78604014-b8b1-4f95-8020-0d00fa250dbc';

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const initNotifications = async () => {
            try {
                if (Capacitor.isNativePlatform()) {
                    console.log("[NotificationProvider] Native platform detected. OneSignal managed by native SDK.");
                } else {
                    console.log("[NotificationProvider] Initializing OneSignal Web SDK...");
                    await OneSignal.init({
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

    useEffect(() => {
        if (!isInitialized || typeof window === 'undefined') return;

        // Listen for auth state changes to re-tag the user
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                console.log("[NotificationProvider] User signed in. Fetching tags...");

                try {
                    // 1. Send Login / External ID
                    if (Capacitor.isNativePlatform()) {
                        await NativeOneSignal.login({ externalId: session.user.id });
                    } else {
                        await OneSignal.login(session.user.id);
                    }

                    // 2. Fetch Profile details (for grade/role)
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('role, grade_level')
                        .eq('id', session.user.id)
                        .single();

                    // 3. Fetch Enrolled Subjects
                    const { data: subjects } = await supabase
                        .from('profile_subjects')
                        .select('subject_id, course_type')
                        .eq('profile_id', session.user.id);

                    // 4. Build Tags Object
                    const tags: Record<string, string> = {};

                    if (profile?.role) tags['role'] = profile.role;
                    if (profile?.grade_level) tags['grade'] = profile.grade_level;

                    if (subjects) {
                        for (const sub of subjects) {
                            tags[`subject_${sub.subject_id}`] = sub.course_type || 'true';
                        }
                    }

                    console.log("[NotificationProvider] Tagging device with:", tags);

                    // 5. Apply Tags to OneSignal
                    if (Capacitor.isNativePlatform()) {
                        await NativeOneSignal.addTags({ tags });
                    } else {
                        await OneSignal.User.addTags(tags);
                    }

                } catch (e) {
                    console.error("[NotificationProvider] Tagging Error:", e);
                }
            } else if (event === 'SIGNED_OUT') {
                console.log("[NotificationProvider] User signed out. Removing OneSignal association.");
                if (Capacitor.isNativePlatform()) {
                    // Reversing externalId would require a logout method, which we can skip or add if needed.
                    // Simplified: We skip explicit logout on native for now unless requested.
                } else {
                    await OneSignal.logout();
                }
            }
        });

        return () => subscription.unsubscribe();
    }, [isInitialized]);

    return <>{children}</>;
}
