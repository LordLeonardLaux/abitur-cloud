'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';

export default function SignupPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    // const supabase = createClient(); // uses singleton

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);
        setError(null);

        const formData = new FormData(event.currentTarget);
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;
        const username = formData.get('username') as string;
        const fullName = formData.get('fullName') as string;

        const { data, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username,
                    full_name: fullName,
                }
            }
        });

        if (signUpError) {
            setError(signUpError.message);
            setLoading(false);
            return;
        }

        // Create profile record
        if (data.user) {
            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: data.user.id,
                    username,
                    full_name: fullName,
                    grade_level: formData.get('gradeLevel') as string,
                    avatar_url: null,
                });

            if (profileError) {
                setError(profileError.message);
                setLoading(false);
                return;
            }
        }

        setSuccess(true);
        setLoading(false);
    }

    if (success) {
        return (
            <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                <div className="w-full max-w-sm space-y-6 bg-white p-8 rounded-2xl shadow-xl border border-gray-100 text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <span className="text-3xl">✓</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Registrierung erfolgreich!</h1>
                    <p className="text-gray-600">
                        Bitte prüfe deine E-Mails und bestätige deinen Account.
                    </p>
                    <Link
                        href="/login"
                        className="inline-block w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-500 transition-colors"
                    >
                        Zum Login
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-sm space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Registrieren</h1>
                    <p className="mt-2 text-sm text-gray-600">Erstelle deinen Abitur Cloud Account</p>
                </div>

                <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">Voller Name</label>
                            <input
                                id="fullName"
                                name="fullName"
                                type="text"
                                required
                                className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                                placeholder="Max Mustermann"
                            />
                        </div>
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">Benutzername</label>
                            <input
                                id="username"
                                name="username"
                                type="text"
                                required
                                className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                                placeholder="maxmustermann"
                            />
                        </div>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                                placeholder="deine@email.de"
                            />

                        </div>
                        <div>
                            <label htmlFor="gradeLevel" className="block text-sm font-medium text-gray-700 mb-1">Jahrgangsstufe</label>
                            <select
                                id="gradeLevel"
                                name="gradeLevel"
                                required
                                className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                            >
                                <option value="" disabled selected>Bitte wählen...</option>
                                <option value="12">Klasse 12</option>
                                <option value="13">Klasse 13</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="new-password"
                                required
                                minLength={6}
                                className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                                placeholder="Mindestens 6 Zeichen"
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
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Account erstellen'}
                    </button>

                    <p className="text-center text-sm text-gray-500">
                        Schon ein Konto?{' '}
                        <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
                            Anmelden
                        </Link>
                    </p>
                </form>
            </div >
        </main >
    );
}
