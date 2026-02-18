'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';

export default function LoginPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // const supabase = createClient(); // uses singleton

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);
        setError(null);

        const formData = new FormData(event.currentTarget);
        let identifier = formData.get('email') as string; // Can be email or username
        const password = formData.get('password') as string;

        // Check if it's an email
        const isEmail = identifier.includes('@');
        let email = identifier;

        if (!isEmail) {
            // Look up email by username using raw fetch
            console.log("Looking up email for username:", identifier);
            try {
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?username=eq.${identifier}&select=email`,
                    {
                        headers: {
                            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                        }
                    }
                );
                if (res.ok) {
                    const data = await res.json();
                    if (data && data[0] && data[0].email) {
                        email = data[0].email;
                        console.log("Found email for username:", email);
                    } else {
                        setError("Benutzername nicht gefunden. Bitte E-Mail verwenden.");
                        setLoading(false);
                        return;
                    }
                } else {
                    setError("Fehler bei der Suche. Bitte E-Mail verwenden.");
                    setLoading(false);
                    return;
                }
            } catch (e) {
                console.error("Username lookup failed:", e);
                setError("Netzwerkfehler. Bitte E-Mail verwenden.");
                setLoading(false);
                return;
            }
        }

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            router.push('/dashboard');
        }
    }

    return (
        <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-sm space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
                <div className="text-center">
                    <img src="/logo.png" alt="Logo" className="w-20 h-20 mx-auto mb-4 object-contain" />
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Abitur Cloud</h1>
                    <p className="mt-2 text-sm text-gray-600">Willkommen zurück!</p>
                </div>

                <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">E-Mail oder Benutzername</label>
                            <input
                                id="email"
                                name="email"
                                type="text"
                                autoComplete="username"
                                required
                                className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                                placeholder="Benutzername oder E-Mail"
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                                placeholder="••••••••"
                            />
                        </div>
                        <div className="text-right">
                            <Link
                                href="/auth/forgot-password"
                                className="text-xs font-medium text-blue-600 hover:text-blue-500"
                            >
                                Passwort vergessen?
                            </Link>
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
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Anmelden'}
                    </button>

                    <p className="text-center text-sm text-gray-500">
                        Noch kein Konto?{' '}
                        <Link href="/signup" className="font-medium text-blue-600 hover:text-blue-500">
                            Registrieren
                        </Link>
                    </p>
                </form>
                <div className="mt-6 pt-4 border-t border-gray-50 text-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">v0.6.9</span>
                </div>
            </div>
        </main>
    );
}
