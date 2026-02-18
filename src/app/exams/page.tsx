'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { SUBJECTS } from '@/lib/constants';
import { Exam, Profile } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronLeft, FileText, Upload, Download, Loader2, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/Sidebar';

function ExamsContent() {
    const { user } = useAuth();
    const router = useRouter();
    const [exams, setExams] = useState<(Exam & { uploader?: Profile })[]>([]);
    const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    // Preview Modal State
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewExam, setPreviewExam] = useState<Exam | null>(null);

    useEffect(() => {
        const fetchExams = async () => {
            // First fetch exams
            const { data: examsData } = await supabase.from('exams').select('*').order('created_at', { ascending: false });

            if (examsData) {
                // Then fetch profiles for these exams
                const userIds = Array.from(new Set(examsData.map(e => e.uploader_id)));
                const { data: profiles } = await supabase.from('profiles').select('*').in('id', userIds);

                const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

                const examsWithProfiles = examsData.map(e => ({
                    ...e,
                    uploader: profileMap.get(e.uploader_id)
                }));

                setExams(examsWithProfiles);
            }
        };
        fetchExams();
    }, []);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        if (!user) {
            alert('Du musst angemeldet sein, um Dateien hochzuladen.');
            return;
        }

        if (!selectedSubject) {
            alert('Bitte wähle zuerst ein Fach aus, bevor du eine Klausur hochlädst.');
            return;
        }

        const file = e.target.files[0];

        // Validate file type
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            alert('Nur PDF-Dateien sind erlaubt.');
            return;
        }

        setUploading(true);

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `exams/${selectedSubject}/${fileName}`;

            console.log('Uploading to path:', filePath);
            const { error: uploadError } = await supabase.storage.from('pdfs').upload(filePath, file);

            if (uploadError) {
                console.error('Storage upload error:', uploadError);
                throw new Error(`Storage-Fehler: ${uploadError.message}`);
            }

            const { error: dbError } = await supabase.from('exams').insert({
                subject_id: selectedSubject,
                title: file.name.replace(`.${fileExt}`, ''),
                uploader_id: user.id,
                storage_path: filePath,
                file_name: file.name
            });

            if (dbError) {
                console.error('Database insert error:', dbError);
                throw new Error(`Datenbank-Fehler: ${dbError.message}`);
            }

            window.location.reload();

        } catch (error: any) {
            console.error('Upload failed:', error);
            alert(`Fehler beim Upload: ${error.message || 'Unbekannter Fehler'}`);
        } finally {
            setUploading(false);
        }
    };

    const handlePreview = async (exam: Exam) => {
        try {
            // Using getPublicUrl instead of createSignedUrl due to server storage issues
            const { data } = supabase.storage.from('pdfs').getPublicUrl(exam.storage_path);
            if (data?.publicUrl) {
                setPreviewUrl(`${data.publicUrl}?t=${Date.now()}`);
                setPreviewExam(exam);
            }
        } catch (error) {
            console.error('Error fetching preview:', error);
        }
    };

    const filteredExams = exams.filter(e =>
        (selectedSubject ? e.subject_id === selectedSubject : true) &&
        (e.title.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="flex min-h-screen bg-gray-50">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
            <div className="flex-1 flex flex-col min-w-0">
                <main className="flex-1 p-4 md:p-8">
                    <div className="max-w-6xl mx-auto space-y-8">
                        {/* Header */}
                        <div className="flex items-center justify-between gap-4 px-2 md:px-0">
                            <div className="flex items-center gap-3">
                                <Link href="/dashboard" className="p-2 -ml-2 rounded-full hover:bg-gray-200">
                                    <ChevronLeft className="w-6 h-6 text-gray-600" />
                                </Link>
                                <div>
                                    <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Klausuren</h1>
                                    <p className="text-gray-500 text-xs md:text-sm">Finden & Teilen</p>
                                </div>
                            </div>
                            {/* Mobile Burger Menu Inline */}
                            <button
                                onClick={() => setIsSidebarOpen(true)}
                                className="md:hidden p-2 bg-white border border-gray-100 shadow-sm rounded-xl text-gray-900 active:scale-95"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                            </button>
                        </div>

                        {/* Subject Filters */}
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
                            <button
                                onClick={() => setSelectedSubject(null)}
                                className={cn("p-2 rounded-xl text-sm font-medium transition-all text-center border", !selectedSubject ? "bg-black text-white border-black" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400")}
                            >
                                Alle
                            </button>
                            {SUBJECTS.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => setSelectedSubject(s.id)}
                                    className={cn("p-2 rounded-xl text-sm font-medium transition-all text-center border", selectedSubject === s.id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300")}
                                >
                                    {s.name}
                                </button>
                            ))}
                        </div>

                        {/* Search & Upload Action */}
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Suchen..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                            {selectedSubject && (
                                <label className={cn("flex items-center gap-2 cursor-pointer px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors", uploading && "opacity-50 pointer-events-none")}>
                                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                    Upload für {SUBJECTS.find(s => s.id === selectedSubject)?.name}
                                    <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={handleUpload} />
                                </label>
                            )}
                        </div>

                        {/* List moved to bottom */}
                        <div className="space-y-2">
                            {filteredExams.length === 0 ? (
                                <div className="bg-white rounded-2xl p-12 flex flex-col items-center justify-center text-gray-400 space-y-2 opacity-50 border border-gray-100">
                                    <FileText size={48} />
                                    <p>Keine Klausuren gefunden.</p>
                                </div>
                            ) : (
                                filteredExams.map(exam => (
                                    <button
                                        key={exam.id}
                                        onClick={() => handlePreview(exam)}
                                        className="w-full bg-white flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:shadow-md transition-all group text-left"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                                                <FileText size={24} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{exam.title}</h3>
                                                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                                    <span className="bg-gray-100 px-1.5 py-0.5 rounded font-medium text-gray-600">{SUBJECTS.find(s => s.id === exam.subject_id)?.name}</span>
                                                    <span>• {new Date(exam.created_at).toLocaleDateString()}</span>
                                                    {exam.uploader && (
                                                        <span className="text-blue-500">• von {exam.uploader.full_name}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-3 text-gray-400 group-hover:text-blue-600">
                                            <FileText size={20} />
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>

                        {/* Preview Modal */}
                        {previewUrl && previewExam && (
                            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setPreviewUrl(null)}>
                                <div className="bg-white rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center justify-between p-4 border-b border-gray-100">
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900">{previewExam.title}</h3>
                                            <p className="text-sm text-gray-500">
                                                {SUBJECTS.find(s => s.id === previewExam.subject_id)?.name} • {new Date(previewExam.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <a
                                                href={previewUrl}
                                                download={previewExam.file_name}
                                                className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                                                title="Download"
                                            >
                                                <Download size={20} />
                                            </a>
                                            <button onClick={() => setPreviewUrl(null)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors">
                                                <X size={20} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex-1 bg-gray-100">
                                        <iframe src={previewUrl} className="w-full h-full" title="PDF Preview" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}

export default function Page() { return <Suspense fallback={<div>Loading...</div>}><ExamsContent /></Suspense> }
