'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import { formatGrade } from '@/lib/utils';

import { sendNotification } from '@/lib/notifications';

export default function Signup() {
    const router = useRouter();
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);
        setError(null);

        const formData = new FormData(event.currentTarget);
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;
        const username = formData.get('username') as string;
        const fullName = formData.get('fullName') as string;
        const gradeLevel = formData.get('gradeLevel') as string;

        if (password.length < 6) {
            setError('Passwort muss mindestens 6 Zeichen lang sein.');
            setLoading(false);
            return;
        }

        try {
            // 1. Create Auth User
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        username: username,
                    }
                }
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error('Benutzer konnte nicht erstellt werden.');

            // 2. Create Profile (is_approved = false by default in DB, but we can set it explicitly to be safe)
            // Note: Triggers might handle this, but explicit is better for this flow changes
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: authData.user.id,
                    email: email,
                    username: username,
                    full_name: fullName,
                    grade_level: gradeLevel,
                    role: gradeLevel === 'teacher' ? 'teacher' : 'student',
                    is_approved: false
                });

            if (profileError) {
                console.error('Profile creation error:', profileError);
                // Continue anyway, user exists in auth
            }

            // 3. Notify Admins (Placeholder for real admin ID logic)
            // Ideally we fetch admin IDs or send to a segment/topic "Admins"
            sendNotification(
                ['admin-segment'], // Placeholder for admin segment/tag
                'Neue Registrierung',
                `${fullName} (${username}) bittet um Zugang.`
            );

            // 4. Redirect to Pending
            router.push('/auth/pending');

        } catch (err: any) {
            console.error('[Signup] Error:', err);
            setError(err.message || 'Ein Fehler ist aufgetreten.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 pt-12 pb-12">
            <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
                <div className="text-center">
                    <img src="/logo.png" alt="Logo" className="w-20 h-20 mx-auto mb-4 object-contain" />
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Abitur Cloud</h1>
                    <p className="mt-2 text-sm text-gray-600">Erstelle dein kostenloses Konto</p>
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
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">E-Mail Adresse</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                                placeholder="deine@email.de"
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                minLength={6}
                                className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                                placeholder="••••••••"
                            />
                        </div>
                        <div>
                            <label htmlFor="gradeLevel" className="block text-sm font-medium text-gray-700 mb-1">Jahrgangsstufe / Rolle</label>
                            <select
                                id="gradeLevel"
                                name="gradeLevel"
                                required
                                className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                            >
                                <option value="" disabled selected>Bitte wählen...</option>
                                <option value="12">{formatGrade('12')}</option>
                                <option value="13">{formatGrade('13')}</option>
                                <option value="teacher">Lehrer/In</option>
                            </select>
                        </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                        <p className="text-xs text-blue-800 leading-relaxed">
                            <strong>Info:</strong> Nach der Registrierung muss dein Account erst von einem Admin freigeschaltet werden.
                        </p>
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
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Registrieren'}
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
