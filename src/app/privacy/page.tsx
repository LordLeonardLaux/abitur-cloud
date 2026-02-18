import React from 'react';

export default function PrivacyPage() {
    return (
        <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <h1 className="text-3xl font-bold text-blue-600 mb-6">Datenschutzerklärung</h1>
                <p className="text-gray-600 mb-8">
                    Dies ist die Datenschutzerklärung für die mobile App und Web-Anwendung <strong>Abitur Cloud</strong>.
                </p>

                <section className="space-y-6 text-gray-700">
                    <div>
                        <h2 className="text-xl font-semibold text-blue-800 mb-2">1. Verantwortliche Stelle</h2>
                        <p>
                            Marc Gruber-Laux<br />
                            E-Mail: marc@abiturcloud.com
                        </p>
                    </div>

                    <div>
                        <h2 className="text-xl font-semibold text-blue-800 mb-2">2. Erhebung und Speicherung personenbezogener Daten</h2>
                        <p>Beim Betrieb der App werden folgende Daten erhoben und verarbeitet:</p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li><strong>Registrierungsdaten:</strong> E-Mail-Adresse, Benutzername, voller Name.</li>
                            <li><strong>Inhaltsdaten:</strong> Von Benutzern hochgeladene PDF-Dokumente und Dateien.</li>
                            <li><strong>Nutzungsdaten:</strong> Informationen über die Interaktion mit der App (z.B. Bearbeitungsstatus von Themen).</li>
                        </ul>
                    </div>

                    <div>
                        <h2 className="text-xl font-semibold text-blue-800 mb-2">3. Zweck der Datenverarbeitung</h2>
                        <p>Die Daten werden ausschließlich zu folgenden Zwecken verwendet:</p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>Bereitstellung der App-Funktionen und Cloud-Dienste.</li>
                            <li>Ermöglichung der Zusammenarbeit zwischen Mitschülern (Teilen von Materialien).</li>
                            <li>Authentifizierung der Benutzer (Login/Signup).</li>
                        </ul>
                    </div>

                    <div>
                        <h2 className="text-xl font-semibold text-blue-800 mb-2">4. Weitergabe von Daten</h2>
                        <p>Daten werden nicht an Dritte verkauft oder zu Werbezwecken weitergegeben. Eine Weitergabe erfolgt nur an notwendige Infrastruktur-Dienstleister (z.B. Supabase) zur technischen Bereitstellung.</p>
                    </div>

                    <div>
                        <h2 className="text-xl font-semibold text-blue-800 mb-2">5. Datensicherheit</h2>
                        <p>Alle Verbindungen sind mit modernen Standards (HTTPS/SSL) verschlüsselt. Die Speicherung erfolgt in sicheren Rechenzentren.</p>
                    </div>
                </section>

                <footer className="mt-12 pt-6 border-t border-gray-100 text-sm text-gray-500 text-center">
                    &copy; {new Date().getFullYear()} Abitur Cloud - Marc Gruber-Laux
                </footer>
            </div>
        </main>
    );
}
