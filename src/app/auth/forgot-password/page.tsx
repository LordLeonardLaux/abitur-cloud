'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Mail, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/reset-password`,
            });

            if (error) throw error;

            setMessage({
                type: 'success',
                text: 'E-Mail zum Zurücksetzen wurde gesendet. Bitte prüfe deinen Posteingang.'
            });
        } catch (err: any) {
            console.error('[ForgotPassword] Error:', err);
            setMessage({
                type: 'error',
                text: err.message || 'Ein Fehler ist aufgetreten.'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-gray-100 text-center">
                <img src="/logo.png" alt="Logo" className="w-20 h-20 mx-auto mb-6 object-contain" />
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">Passwort vergessen?</h1>
                <p className="mt-2 text-sm text-gray-600">Kein Problem! Wir senden dir einen Link zum Zurücksetzen.</p>

                <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                            Deine E-Mail Adresse
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                            placeholder="name@beispiel.de"
                        />
                    </div>

                    {message && (
                        <div className={cn(
                            "p-3 rounded-lg text-sm text-center",
                            message.type === 'success' ? "bg-green-50 text-green-700" : "bg-red-50 text-red-500"
                        )}>
                            {message.text}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="group relative flex w-full justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Link senden'}
                    </button>

                    <div className="text-center">
                        <Link
                            href="/login"
                            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
                        >
                            <ArrowLeft size={16} />
                            Zurück zum Login
                        </Link>
                    </div>
                </form>
            </div>
        </main>
    );
}
