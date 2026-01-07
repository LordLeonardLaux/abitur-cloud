'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { SUBJECTS } from '@/lib/constants';
import { Exam, Profile } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronLeft, FileText, Upload, Download, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

function ExamsContent() {
    const { user } = useAuth();
    const router = useRouter();
    const [exams, setExams] = useState<Exam[]>([]);
    const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        // Fetch all exams
        const fetchExams = async () => {
            const { data } = await supabase.from('exams').select('*').order('created_at', { ascending: false });
            if (data) setExams(data);
        };
        fetchExams();
    }, []);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !user || !selectedSubject) return;
        const file = e.target.files[0];
        setUploading(true);

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `exams/${selectedSubject}/${fileName}`;

            // 1. Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from('pdfs') // Reuse simple bucket for now, ideally 'exams'
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Create DB Record
            const { error: dbError } = await supabase.from('exams').insert({
                subject_id: selectedSubject,
                title: file.name.replace(`.${fileExt}`, ''),
                uploader_id: user.id,
                storage_path: filePath,
                file_name: file.name
            });

            if (dbError) throw dbError;

            // Refresh
            const { data } = await supabase.from('exams').select('*').order('created_at', { ascending: false });
            if (data) setExams(data);

        } catch (error) {
            console.error('Upload failed:', error);
            alert('Fehler beim Upload!');
        } finally {
            setUploading(false);
        }
    };

    const downloadExam = async (exam: Exam) => {
        const { data, error } = await supabase.storage.from('pdfs').download(exam.storage_path);
        if (data) {
            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = exam.file_name;
            a.click();
        }
    };

    const filteredExams = exams.filter(e =>
        (selectedSubject ? e.subject_id === selectedSubject : true) &&
        (e.title.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <main className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link href="/dashboard" className="p-2 -ml-2 rounded-full hover:bg-gray-200">
                        <ChevronLeft className="w-6 h-6 text-gray-600" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Alt-Klausuren 📚</h1>
                        <p className="text-gray-500">Teile und finde wichtige Klausuren.</p>
                    </div>
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

                {/* Main Content */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 min-h-[500px] flex flex-col">
                    {/* Toolbar */}
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-4">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Suchen..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-gray-50 rounded-lg text-sm border-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        {selectedSubject && (
                            <div className="relative">
                                <label className={cn("flex items-center gap-2 cursor-pointer px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors", uploading && "opacity-50 pointer-events-none")}>
                                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                    Upload für {SUBJECTS.find(s => s.id === selectedSubject)?.name}
                                    <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={handleUpload} />
                                </label>
                            </div>
                        )}
                    </div>

                    {/* List */}
                    <div className="flex-1 p-4 space-y-2">
                        {filteredExams.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2 opacity-50">
                                <FileText size={48} />
                                <p>Keine Klausuren gefunden.</p>
                            </div>
                        ) : (
                            filteredExams.map(exam => (
                                <div key={exam.id} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                                            <FileText size={20} />
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-gray-900">{exam.title}</h3>
                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                                <span className="bg-gray-100 px-1.5 py-0.5 rounded">{SUBJECTS.find(s => s.id === exam.subject_id)?.name}</span>
                                                <span>• {new Date(exam.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => downloadExam(exam)} className="p-2 text-gray-400 hover:text-blue-600 rounded-full hover:bg-blue-50 transition-colors">
                                        <Download size={20} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}

export default function Page() { return <Suspense fallback={<div>Loading...</div>}><ExamsContent /></Suspense> }
