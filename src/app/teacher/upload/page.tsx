'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { SUBJECTS, SEMESTERS } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { ChevronLeft, Upload, Loader2, Check, GraduationCap } from 'lucide-react';
import { cn, formatGrade } from '@/lib/utils';

function UploadContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { user, profile } = useAuth();

    const initialSubject = searchParams.get('subject') || '';

    const [teacherSubjects, setTeacherSubjects] = useState<string[]>([]);
    const [selectedSubject, setSelectedSubject] = useState(initialSubject);
    const [uploadType, setUploadType] = useState<'semester' | 'calendar'>('semester');
    const [selectedSemester, setSelectedSemester] = useState('Q1');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedLesson, setSelectedLesson] = useState(1);
    const [selectedGrade, setSelectedGrade] = useState<'12' | '13'>('13');
    const [file, setFile] = useState<File | null>(null);
    const [fileName, setFileName] = useState('');
    const [uploading, setUploading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        async function loadSubjects() {
            if (!user) return;
            const { data } = await supabase
                .from('user_subjects')
                .select('subject_id')
                .eq('user_id', user.id);
            if (data) {
                setTeacherSubjects(data.map(s => s.subject_id));
                if (!selectedSubject && data.length > 0) {
                    setSelectedSubject(data[0].subject_id);
                }
            }
        }
        loadSubjects();
    }, [user, selectedSubject]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const f = e.target.files[0];
            setFile(f);
            setFileName(f.name.replace(/\.[^/.]+$/, ''));
        }
    };

    const handleUpload = async () => {
        if (!file || !user || !selectedSubject) return;

        setUploading(true);
        setError('');

        try {
            const fileExt = file.name.split('.').pop();
            const storageName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

            // Storage path differs slightly based on type for organization
            const folder = uploadType === 'semester' ? selectedSemester : selectedDate;
            const storagePath = `${user.id}/${selectedSubject}/${folder}/${storageName}`;

            // Upload to storage
            const { error: uploadError } = await supabase.storage
                .from('teacher-materials')
                .upload(storagePath, file);

            if (uploadError) throw uploadError;

            // Insert into database
            const dbPayload: any = {
                teacher_id: user.id,
                subject_id: selectedSubject,
                grade_level: selectedGrade,
                file_name: `${fileName}.${fileExt}`,
                storage_path: storagePath,
            };

            if (uploadType === 'semester') {
                dbPayload.semester = selectedSemester;
            } else {
                dbPayload.material_date = selectedDate;
                dbPayload.lesson_hour = selectedLesson;
            }

            const { error: dbError } = await supabase.from('teacher_materials').insert(dbPayload);

            if (dbError) throw dbError;

            setSuccess(true);
            setTimeout(() => {
                router.push('/teacher/dashboard');
            }, 1500);
        } catch (err: any) {
            console.error('Upload error:', err);
            setError(err.message || 'Upload fehlgeschlagen');
        } finally {
            setUploading(false);
        }
    };

    // Redirect non-teachers
    if (profile && profile.role !== 'teacher') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center p-8 bg-white rounded-2xl shadow-lg">
                    <GraduationCap size={48} className="mx-auto mb-4 text-gray-400" />
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Kein Lehrer-Zugang</h2>
                    <p className="text-gray-500 mb-4">Diese Seite ist nur für Lehrer zugänglich.</p>
                    <Link href="/dashboard" className="text-blue-600 font-medium hover:underline">
                        Zurück zum Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    const displayedSubjects = SUBJECTS.filter(s => teacherSubjects.includes(s.id));

    return (
        <main className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <Link href="/teacher/dashboard" className="p-2 -ml-2 rounded-full hover:bg-gray-200 transition-colors">
                        <ChevronLeft className="w-6 h-6 text-gray-600" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-extrabold text-gray-900">Material hochladen</h1>
                        <p className="text-gray-500 text-sm">Schulinhalte für deine Schüler</p>
                    </div>
                </div>

                {/* Upload Form */}
                <div className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
                    {/* Upload Type Toggle */}
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        <button
                            onClick={() => setUploadType('semester')}
                            className={cn(
                                "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
                                uploadType === 'semester' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            Quartal
                        </button>
                        <button
                            onClick={() => setUploadType('calendar')}
                            className={cn(
                                "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
                                uploadType === 'calendar' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            Kalender
                        </button>
                    </div>

                    {/* Subject */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Fach</label>
                        <div className="flex flex-wrap gap-2">
                            {displayedSubjects.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => setSelectedSubject(s.id)}
                                    className={cn(
                                        "px-4 py-2 rounded-xl text-sm font-semibold transition-all border",
                                        selectedSubject === s.id
                                            ? "bg-blue-600 text-white border-blue-600"
                                            : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                                    )}
                                >
                                    {s.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Grade & Conditional Fields */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Jahrgang</label>
                            <div className="flex gap-2">
                                {(['13', '12'] as const).map(g => (
                                    <button
                                        key={g}
                                        onClick={() => setSelectedGrade(g)}
                                        className={cn(
                                            "flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border flex flex-col items-center justify-center",
                                            selectedGrade === g
                                                ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                                                : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                                        )}
                                    >
                                        <span>Jg. {g}</span>
                                        <span className={cn("text-[10px] font-medium leading-none mt-0.5", selectedGrade === g ? "text-indigo-100" : "text-gray-400")}>
                                            ({formatGrade(g).split('(')[1]}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {uploadType === 'semester' ? (
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Quartal</label>
                                <div className="flex gap-2">
                                    {SEMESTERS.map(sem => (
                                        <button
                                            key={sem}
                                            onClick={() => setSelectedSemester(sem)}
                                            className={cn(
                                                "flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border",
                                                selectedSemester === sem
                                                    ? "bg-purple-600 text-white border-purple-600"
                                                    : "bg-white text-gray-600 border-gray-200 hover:border-purple-300"
                                            )}
                                        >
                                            {sem}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Stunde</label>
                                <select
                                    value={selectedLesson}
                                    onChange={(e) => setSelectedLesson(Number(e.target.value))}
                                    className="w-full px-4 py-2.5 rounded-xl text-sm font-bold border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(h => (
                                        <option key={h} value={h}>{h}. Stunde</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {uploadType === 'calendar' && (
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Datum</label>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    )}

                    {/* File Selection */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Datei</label>
                        <label className="block w-full p-6 border-2 border-dashed border-gray-200 rounded-xl text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 transition-colors">
                            {file ? (
                                <div className="flex items-center justify-center gap-2 text-blue-600">
                                    <Check size={20} />
                                    <span className="font-medium truncate max-w-[200px]">{file.name}</span>
                                </div>
                            ) : (
                                <div className="text-gray-400">
                                    <Upload size={24} className="mx-auto mb-2" />
                                    <span className="font-medium">Datei auswählen</span>
                                </div>
                            )}
                            <input type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
                        </label>
                    </div>

                    {/* File Name */}
                    {file && (
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Dateiname</label>
                            <input
                                type="text"
                                value={fileName}
                                onChange={(e) => setFileName(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Name des Materials"
                            />
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
                            {error}
                        </div>
                    )}

                    {/* Success */}
                    {success && (
                        <div className="p-3 bg-green-50 text-green-600 rounded-xl text-sm font-medium flex items-center gap-2">
                            <Check size={18} />
                            Upload erfolgreich! Weiterleitung...
                        </div>
                    )}

                    {/* Upload Button */}
                    <button
                        onClick={handleUpload}
                        disabled={!file || !selectedSubject || uploading || success}
                        className={cn(
                            "w-full py-4 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2",
                            (!file || !selectedSubject || uploading || success)
                                ? "bg-gray-300 cursor-not-allowed"
                                : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98]"
                        )}
                    >
                        {uploading ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                Lade hoch...
                            </>
                        ) : (
                            <>
                                <Upload size={20} />
                                Hochladen
                            </>
                        )}
                    </button>
                </div>
            </div>
        </main>
    );
}

export default function TeacherUploadPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>}>
            <UploadContent />
        </Suspense>
    );
}
