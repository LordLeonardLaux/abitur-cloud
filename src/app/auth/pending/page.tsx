'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ShieldAlert, LogOut } from 'lucide-react';

export default function PendingApprovalPage() {
    const { user, profile, signOut, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            // If approved, go to dashboard
            if (profile?.is_approved) {
                router.replace('/dashboard');
            }
            // If not logged in, go to login
            else if (!user) {
                router.replace('/login');
            }
        }
    }, [user, profile, loading, router]);

    if (loading) return null;

    return (
        <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-gray-100 text-center">
                <img src="/logo.png" alt="Logo" className="w-20 h-20 mx-auto mb-6 object-contain" />

                <h1 className="text-2xl font-black text-gray-900 mb-3">
                    Account wird geprüft ⏳
                </h1>

                <p className="text-gray-500 mb-8 leading-relaxed">
                    Vielen Dank für deine Registrierung! <br />
                    Ein Administrator muss deinen Account erst freischalten, bevor du Zugriff erhältst.
                </p>

                <div className="bg-amber-50 rounded-xl p-4 mb-8 text-sm text-amber-800 border border-amber-100">
                    <strong>Hinweis:</strong> Du erhältst Zugriff, sobald die Freischaltung erfolgt ist. Bitte versuche es später erneut.
                </div>

                <button
                    onClick={() => signOut()}
                    className="w-full py-3 flex items-center justify-center gap-2 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-colors"
                >
                    <LogOut size={18} />
                    Abmelden
                </button>
            </div>
        </main>
    );
}
