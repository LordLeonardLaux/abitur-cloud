'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ResetPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Supabase handles the session from the URL automatically if configured
    // but we can ensure we have a session.
    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                // If no session, the link might be expired or invalid
                console.warn('[ResetPassword] No session found. Link might be expired.');
            }
        };
        checkSession();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('Passwörter stimmen nicht überein.');
            return;
        }

        if (password.length < 6) {
            setError('Passwort muss mindestens 6 Zeichen lang sein.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: password
            });

            if (updateError) throw updateError;

            setSuccess(true);
            // Redirect to login after a short delay
            setTimeout(() => {
                router.push('/login');
            }, 3000);

        } catch (err: any) {
            console.error('[ResetPassword] Error:', err);
            setError(err.message || 'Ein Fehler ist aufgetreten.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                <div className="w-full max-w-sm space-y-6 bg-white p-8 rounded-2xl shadow-xl border border-gray-100 text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 className="text-green-600" size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Passwort geändert!</h1>
                    <p className="text-gray-600">
                        Dein Passwort wurde erfolgreich aktualisiert. Du wirst in Kürze zum Login weitergeleitet...
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-sm space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
                <div className="text-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Lock className="text-blue-600" size={24} />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">Neues Passwort setzen</h1>
                    <p className="mt-2 text-sm text-gray-600">Bitte gib dein neues Passwort ein.</p>
                </div>

                <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="pass" className="block text-sm font-medium text-gray-700 mb-1">
                                Neues Passwort
                            </label>
                            <input
                                id="pass"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                                placeholder="••••••••"
                            />
                        </div>
                        <div>
                            <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-1">
                                Passwort bestätigen
                            </label>
                            <input
                                id="confirm"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-500 text-center">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="group relative flex w-full justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Passwort speichern'}
                    </button>
                </form>
            </div>
        </main>
    );
}
