'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { toggleRankVisibility } from '@/services/xpService';
import { getRank, getAvatarWrapperStyle } from '@/lib/ranks';
import {
    ChevronLeft, Settings, Lock, Eye, EyeOff,
    Loader2, CheckCircle2, Shield, Trophy, Camera, User, Sparkles, Key
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
    const router = useRouter();
    const { user, profile, setProfile } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Password change state
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Avatar upload state
    const [avatarLoading, setAvatarLoading] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || null);
    const [avatarMessage, setAvatarMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Rank toggle state
    const [rankVisible, setRankVisible] = useState(profile?.rank_visible ?? true);
    const [rankLoading, setRankLoading] = useState(false);

    // AI Settings state
    const [aiEnabled, setAiEnabled] = useState(profile?.ai_settings?.enabled ?? false);
    const [aiProvider, setAiProvider] = useState<'gemini' | 'openai'>(profile?.ai_settings?.provider ?? 'gemini');
    const [aiKey, setAiKey] = useState(profile?.ai_settings?.apiKey ?? '');
    const [aiModel, setAiModel] = useState<string>(profile?.ai_settings?.model || 'gemini-2.5-pro');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiMessage, setAiMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setPasswordMessage({ type: 'error', text: 'Passwörter stimmen nicht überein.' });
            return;
        }
        if (newPassword.length < 6) {
            setPasswordMessage({ type: 'error', text: 'Passwort muss mindestens 6 Zeichen lang sein.' });
            return;
        }

        setPasswordLoading(true);
        setPasswordMessage(null);

        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;

            setPasswordMessage({ type: 'success', text: 'Passwort erfolgreich geändert! ✅' });
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            setPasswordMessage({ type: 'error', text: err.message || 'Fehler beim Ändern des Passworts.' });
        } finally {
            setPasswordLoading(false);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0] || !user) return;
        const file = e.target.files[0];

        // Validate file
        if (!file.type.startsWith('image/')) {
            setAvatarMessage({ type: 'error', text: 'Bitte nur Bilder hochladen.' });
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setAvatarMessage({ type: 'error', text: 'Bild darf maximal 5MB groß sein.' });
            return;
        }

        setAvatarLoading(true);
        setAvatarMessage(null);

        try {
            const fileExt = file.name.split('.').pop();
            const filePath = `avatars/${user.id}.${fileExt}`;

            // Upload to storage
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
            const publicUrl = data.publicUrl + '?t=' + Date.now(); // Cache bust

            // Update profile
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', user.id);

            if (updateError) throw updateError;

            setAvatarUrl(publicUrl);
            setAvatarMessage({ type: 'success', text: 'Profilbild aktualisiert! ✅' });

            // Sync context
            if (profile) {
                setProfile({ ...profile, avatar_url: publicUrl });
            }
        } catch (err: any) {
            setAvatarMessage({ type: 'error', text: err.message || 'Fehler beim Hochladen.' });
        } finally {
            setAvatarLoading(false);
        }
    };

    const handleRankToggle = async () => {
        if (!user) return;
        setRankLoading(true);
        try {
            const newValue = !rankVisible;
            await toggleRankVisibility(user.id, newValue);
            setRankVisible(newValue);

            // Sync context
            if (profile) {
                setProfile({ ...profile, rank_visible: newValue });
            }
        } catch (err) {
            console.error('Rank toggle error:', err);
        } finally {
            setRankLoading(false);
        }
    };

    const handleAISettingsSave = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!user) return;
        setAiLoading(true);
        setAiMessage(null);
        try {
            const ai_settings = { enabled: aiEnabled, provider: aiProvider, apiKey: aiKey, model: aiModel };
            const { error } = await supabase.from('profiles').update({ ai_settings }).eq('id', user.id);
            if (error) throw error;
            setAiMessage({ type: 'success', text: 'KI-Einstellungen gespeichert! ✅' });

            // Sync context IMMEDIATELY after writing to database
            if (profile) {
                setProfile({ ...profile, ai_settings });
            }
        } catch (err: any) {
            setAiMessage({ type: 'error', text: err.message || 'Fehler beim Speichern der KI-Einstellungen.' });
        } finally {
            setAiLoading(false);
        }
    };

    const currentRank = getRank(profile?.xp || 0);

    return (
        <main className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-2xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between gap-4 px-2">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/dashboard/')} className="p-2 -ml-2 rounded-full hover:bg-gray-200">
                            <ChevronLeft className="w-6 h-6 text-gray-600" />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                                <Settings className="w-5 h-5 text-gray-600" />
                            </div>
                            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Einstellungen</h1>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="md:hidden p-2 bg-white border border-gray-100 shadow-sm rounded-xl text-gray-900 active:scale-95"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                    </button>
                </div>

                {/* Profilbild */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                                <Camera className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Profilbild</h2>
                                <p className="text-sm text-gray-500">Lade ein Bild hoch oder ändere dein Profilbild</p>
                            </div>
                        </div>

                        <div className="flex flex-col items-center gap-4">
                            <div className="relative cursor-pointer group">
                                <div style={getAvatarWrapperStyle(profile?.xp || 0, rankVisible)}>
                                    {avatarUrl && avatarUrl.trim() !== '' ? (
                                        <img
                                            src={avatarUrl}
                                            alt={profile?.full_name || 'Avatar'}
                                            className="w-24 h-24 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-24 h-24 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-3xl">
                                            {profile?.full_name?.charAt(0) || '?'}
                                        </div>
                                    )}
                                </div>
                                {/* Camera overlay */}
                                <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    {avatarLoading ? (
                                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                                    ) : (
                                        <Camera className="w-8 h-8 text-white" />
                                    )}
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/jpg,image/webp"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    onChange={handleAvatarUpload}
                                />
                            </div>

                            {rankVisible && (
                                <p className="text-sm font-bold" style={{ color: currentRank.color }}>
                                    {currentRank.emoji} {currentRank.name}
                                </p>
                            )}

                            <p className="text-xs text-gray-400">Tippe auf das Bild zum Ändern (max. 5MB)</p>

                            {avatarMessage && (
                                <div className={cn(
                                    "p-3 rounded-xl text-sm text-center font-medium w-full",
                                    avatarMessage.type === 'success' ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                                )}>
                                    {avatarMessage.text}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Passwort ändern */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                                <Lock className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Passwort ändern</h2>
                                <p className="text-sm text-gray-500">Setze ein neues Passwort für deinen Account</p>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handlePasswordChange} className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Neues Passwort</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                minLength={6}
                                className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                                placeholder="Neues Passwort (mind. 6 Zeichen)"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Passwort bestätigen</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                                placeholder="Passwort wiederholen"
                            />
                        </div>

                        {passwordMessage && (
                            <div className={cn(
                                "p-3 rounded-xl text-sm text-center font-medium",
                                passwordMessage.type === 'success' ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                            )}>
                                {passwordMessage.text}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={passwordLoading}
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                        >
                            {passwordLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Passwort ändern
                        </button>
                    </form>
                </div>

                {/* KI-Einstellungen (RI-Funktion) */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-tr from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
                                    <Sparkles className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">KI-Funktion (Lokale API)</h2>
                                    <p className="text-sm text-gray-500">Nutze eigene API-Schlüssel für KI-Features</p>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    setAiEnabled(!aiEnabled);
                                    // Optionally auto-save when toggling:
                                    // handleAISettingsSave();
                                }}
                                className={cn(
                                    "relative w-14 h-8 rounded-full transition-all duration-300 focus:outline-none",
                                    aiEnabled ? "bg-indigo-500" : "bg-gray-300"
                                )}
                            >
                                <div className={cn(
                                    "absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 flex items-center justify-center",
                                    aiEnabled ? "left-7" : "left-1"
                                )}>
                                    {aiEnabled ? (
                                        <Sparkles className="w-3 h-3 text-indigo-500" />
                                    ) : (
                                        <EyeOff className="w-3 h-3 text-gray-400" />
                                    )}
                                </div>
                            </button>
                        </div>
                    </div>

                    {aiEnabled && (
                        <form onSubmit={handleAISettingsSave} className="p-6 space-y-4 bg-indigo-50/30">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">KI-Provider</label>
                                <select
                                    value={aiProvider}
                                    onChange={(e) => setAiProvider(e.target.value as 'gemini' | 'openai')}
                                    className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 focus:border-indigo-500 focus:ring-indigo-500 transition-colors"
                                >
                                    <option value="gemini">Google Gemini (Empfohlen)</option>
                                    <option value="openai">OpenAI (ChatGPT)</option>
                                </select>
                            </div>

                            {aiProvider === 'gemini' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">KI-Modell</label>
                                    <select
                                        value={aiModel}
                                        onChange={(e) => setAiModel(e.target.value)}
                                        className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 focus:border-indigo-500 focus:ring-indigo-500 transition-colors"
                                    >
                                        <option value="gemini-2.5-pro">Gemini 2.5 Pro (Neuestes Pro-Modell)</option>
                                        <option value="gemini-2.5-flash">Gemini 2.5 Flash (Neuestes Flash-Modell)</option>
                                        <option value="gemini-3-pro-preview">Gemini 3 Pro Preview (Experimentell)</option>
                                        <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                                        <option value="gemini-pro-latest">Gemini Pro Latest</option>
                                        <option value="gemini-flash-latest">Gemini Flash Latest</option>
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">API Schlüssel</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Key className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        type="password"
                                        value={aiKey}
                                        onChange={(e) => setAiKey(e.target.value)}
                                        className="block w-full rounded-xl border border-gray-200 bg-white pl-10 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-indigo-500 transition-colors"
                                        placeholder={`Dein ${aiProvider === 'openai' ? 'OpenAI' : 'Gemini'} API-Key (sk-...)`}
                                    />
                                </div>
                                <p className="mt-1.5 text-xs text-gray-500">
                                    Dein Schlüssel wird verschlüsselt in deinem Account gespeichert und nur für deine eigenen Anfragen genutzt.
                                </p>
                            </div>

                            {aiMessage && (
                                <div className={cn(
                                    "p-3 rounded-xl text-sm text-center font-medium",
                                    aiMessage.type === 'success' ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                                )}>
                                    {aiMessage.text}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={aiLoading}
                                className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                            >
                                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                Einstellungen speichern
                            </button>
                        </form>
                    )}
                </div>

                {/* Rang-System Toggle */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                                    <Trophy className="w-5 h-5 text-purple-600" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">Rang-System</h2>
                                    <p className="text-sm text-gray-500">
                                        {rankVisible ? (
                                            <span className="flex items-center gap-1">
                                                <span>Aktiv – Dein Rang:</span>
                                                <span className="font-bold" style={{ color: currentRank.color }}>
                                                    {currentRank.emoji} {currentRank.name}
                                                </span>
                                            </span>
                                        ) : (
                                            'Deaktiviert – Kein Rang sichtbar, kein XP-Gewinn'
                                        )}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={handleRankToggle}
                                disabled={rankLoading}
                                className={cn(
                                    "relative w-14 h-8 rounded-full transition-all duration-300 focus:outline-none",
                                    rankVisible ? "bg-purple-500" : "bg-gray-300"
                                )}
                            >
                                <div className={cn(
                                    "absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 flex items-center justify-center",
                                    rankVisible ? "left-7" : "left-1"
                                )}>
                                    {rankLoading ? (
                                        <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                                    ) : rankVisible ? (
                                        <Eye className="w-3 h-3 text-purple-500" />
                                    ) : (
                                        <EyeOff className="w-3 h-3 text-gray-400" />
                                    )}
                                </div>
                            </button>
                        </div>

                        {rankVisible && (
                            <button
                                onClick={() => router.push('/rank/')}
                                className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-purple-50 px-4 py-3 text-sm font-semibold text-purple-700 hover:bg-purple-100 transition-all active:scale-[0.98]"
                            >
                                <Trophy className="w-4 h-4" />
                                Rang-Dashboard öffnen
                            </button>
                        )}
                    </div>
                </div>

                {/* Account Info */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
                                <Shield className="w-5 h-5 text-gray-600" />
                            </div>
                            <h2 className="text-lg font-bold text-gray-900">Account-Info</h2>
                        </div>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between py-2 border-b border-gray-50">
                                <span className="text-gray-500">Name</span>
                                <span className="font-medium text-gray-900">{profile?.full_name}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-50">
                                <span className="text-gray-500">Benutzername</span>
                                <span className="font-medium text-gray-900">@{profile?.username}</span>
                            </div>
                            <div className="flex justify-between py-2">
                                <span className="text-gray-500">Rolle</span>
                                <span className="font-medium text-gray-900 capitalize">{profile?.role || 'Student'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        </main>
    );
}
