'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { SUBJECTS } from '@/lib/constants';
import { ClassMaterial, Profile } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronLeft, ChevronRight, Upload, Download, FileText, Calendar, Trash2, Edit3, X } from 'lucide-react';
import { cn } from '@/lib/utils';

function MaterialsContent() {
    const { user } = useAuth();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [materials, setMaterials] = useState<ClassMaterial[]>([]);
    const [selectedSubject, setSelectedSubject] = useState<string>('mathe');
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [dayMaterials, setDayMaterials] = useState<ClassMaterial[]>([]);

    // Preview Modal State
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewFile, setPreviewFile] = useState<ClassMaterial | null>(null);

    // Upload Modal State
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [uploadSubject, setUploadSubject] = useState('mathe');
    const [uploadFileName, setUploadFileName] = useState('');
    const [uploadLessonHour, setUploadLessonHour] = useState<number>(1);

    // Edit Modal State
    const [editingMaterial, setEditingMaterial] = useState<ClassMaterial | null>(null);
    const [editDate, setEditDate] = useState('');
    const [editName, setEditName] = useState('');
    const [editLessonHour, setEditLessonHour] = useState<number>(1);

    const isSmartboard = profile?.role === 'smartboard';

    useEffect(() => {
        if (user) {
            supabase.from('profiles').select('*').eq('id', user.id).single()
                .then(({ data }) => setProfile(data));
        }
    }, [user]);

    useEffect(() => {
        const fetchMaterials = async () => {
            const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
            const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

            const { data } = await supabase
                .from('class_materials')
                .select('*')
                .eq('subject_id', selectedSubject)
                .gte('material_date', startOfMonth.toISOString().split('T')[0])
                .lte('material_date', endOfMonth.toISOString().split('T')[0])
                .order('material_date');

            setMaterials(data || []);
        };
        fetchMaterials();
    }, [currentMonth, selectedSubject]);

    useEffect(() => {
        if (selectedDate) {
            const filtered = materials.filter(m => m.material_date === selectedDate);
            setDayMaterials(filtered);
        } else {
            setDayMaterials([]);
        }
    }, [selectedDate, materials]);

    // Handle file selection - opens modal
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0] || !isSmartboard) return;
        const file = e.target.files[0];
        setPendingFile(file);
        setUploadFileName(file.name.replace(/\.[^/.]+$/, '')); // Remove extension
        setUploadSubject(selectedSubject);
        setUploadLessonHour(1); // Default to 1st hour
        setShowUploadModal(true);
        e.target.value = ''; // Reset input
    };

    // Confirm upload with custom name and subject
    const confirmUpload = async () => {
        if (!pendingFile || !user || !isSmartboard) return;

        const today = new Date().toISOString().split('T')[0];
        const fileExt = pendingFile.name.split('.').pop();
        const finalFileName = `${uploadFileName}.${fileExt}`;

        setUploading(true);
        try {
            const storageName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `materials/${uploadSubject}/${today}/${storageName}`;

            const { error: uploadError } = await supabase.storage.from('materials').upload(filePath, pendingFile);
            if (uploadError) throw uploadError;

            const { error: dbError } = await supabase.from('class_materials').insert({
                uploader_id: user.id,
                subject_id: uploadSubject,
                material_date: today,
                file_name: finalFileName,
                storage_path: filePath,
                lesson_hour: uploadLessonHour
            });
            if (dbError) throw dbError;

            setShowUploadModal(false);
            setPendingFile(null);
            window.location.reload();
        } catch (error: any) {
            console.error('Upload failed:', error);
            alert(`Fehler: ${error.message}`);
        } finally {
            setUploading(false);
        }
    };

    // Delete material
    const deleteMaterial = async (m: ClassMaterial) => {
        if (!confirm('Wirklich löschen?')) return;

        try {
            await supabase.storage.from('materials').remove([m.storage_path]);
            await supabase.from('class_materials').delete().eq('id', m.id);
            window.location.reload();
        } catch (error: any) {
            alert(`Fehler beim Löschen: ${error.message}`);
        }
    };

    // Open edit modal
    const openEditModal = (m: ClassMaterial) => {
        setEditingMaterial(m);
        setEditDate(m.material_date);
        setEditName(m.file_name.replace(/\.[^/.]+$/, '')); // Without extension
        setEditLessonHour(m.lesson_hour || 1);
    };

    // Confirm edit
    const confirmEdit = async () => {
        if (!editingMaterial) return;

        const fileExt = editingMaterial.file_name.split('.').pop();
        const newFileName = `${editName}.${fileExt}`;

        try {
            const { error } = await supabase
                .from('class_materials')
                .update({
                    material_date: editDate,
                    file_name: newFileName,
                    lesson_hour: editLessonHour
                })
                .eq('id', editingMaterial.id);

            if (error) throw error;
            setEditingMaterial(null);
            window.location.reload();
        } catch (error: any) {
            alert(`Fehler: ${error.message}`);
        }
    };

    const handlePreview = async (m: ClassMaterial) => {
        try {
            const { data } = await supabase.storage.from('materials').createSignedUrl(m.storage_path, 3600);
            if (data?.signedUrl) {
                setPreviewUrl(data.signedUrl);
                setPreviewFile(m);
            }
        } catch (error) {
            console.error('Error fetching preview:', error);
        }
    };

    // Calendar helpers
    const getDaysInMonth = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days: (number | null)[] = [];
        const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;
        for (let i = 0; i < adjustedFirstDay; i++) days.push(null);
        for (let i = 1; i <= daysInMonth; i++) days.push(i);
        return days;
    };

    const hasContentOnDay = (day: number) => {
        const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return materials.some(m => m.material_date === dateStr);
    };

    const getDateString = (day: number) => {
        return `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

    return (
        <main className="min-h-screen bg-gray-50 p-8 pt-14">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between pl-12">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="p-2 -ml-2 rounded-full hover:bg-gray-200">
                            <ChevronLeft className="w-6 h-6 text-gray-600" />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Unterrichtsmaterial 📅</h1>
                            <p className="text-gray-500">Smartboard-Mitschriften nach Datum</p>
                        </div>
                    </div>

                    {/* BIG Upload Button for Smartboard */}
                    {isSmartboard && (
                        <label className={cn(
                            "flex items-center gap-3 px-6 py-4 rounded-2xl cursor-pointer transition-all shadow-lg",
                            uploading
                                ? "bg-gray-300 text-gray-500"
                                : "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700"
                        )}>
                            <Upload size={24} />
                            <span className="font-bold text-lg">Mitschrift hochladen</span>
                            <input
                                type="file"
                                accept="application/pdf,image/*"
                                className="hidden"
                                onChange={handleFileSelect}
                                disabled={uploading}
                            />
                        </label>
                    )}
                </div>

                {/* Subject Tabs */}
                <div className="flex flex-wrap gap-2">
                    {SUBJECTS.map(s => (
                        <button
                            key={s.id}
                            onClick={() => { setSelectedSubject(s.id); setSelectedDate(null); }}
                            className={cn(
                                "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                                selectedSubject === s.id
                                    ? "bg-blue-600 text-white"
                                    : "bg-white text-gray-600 border border-gray-200 hover:border-blue-300"
                            )}
                        >
                            {s.name}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Calendar */}
                    <div className="bg-white rounded-2xl shadow-lg p-6">
                        <div className="flex items-center justify-between mb-6">
                            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} className="p-2 hover:bg-gray-100 rounded-lg">
                                <ChevronLeft size={20} />
                            </button>
                            <h2 className="text-xl font-bold text-gray-900">
                                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                            </h2>
                            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} className="p-2 hover:bg-gray-100 rounded-lg">
                                <ChevronRight size={20} />
                            </button>
                        </div>

                        <div className="grid grid-cols-7 gap-1 mb-2">
                            {weekDays.map(d => (
                                <div key={d} className="text-center text-xs font-bold text-gray-400 py-2">{d}</div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1">
                            {getDaysInMonth().map((day, idx) => (
                                <button
                                    key={idx}
                                    disabled={day === null}
                                    onClick={() => day && setSelectedDate(getDateString(day))}
                                    className={cn(
                                        "aspect-square rounded-lg flex flex-col items-center justify-center text-sm font-medium transition-all",
                                        day === null && "invisible",
                                        day && selectedDate === getDateString(day) && "bg-blue-600 text-white",
                                        day && selectedDate !== getDateString(day) && "hover:bg-gray-100",
                                    )}
                                >
                                    {day}
                                    {day && (
                                        <div className={cn("w-2 h-2 rounded-full mt-1", hasContentOnDay(day) ? "bg-green-500" : "bg-red-400")} />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Day Detail */}
                    <div className="bg-white rounded-2xl shadow-lg p-6">
                        {selectedDate ? (
                            <>
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold text-gray-900">
                                        <Calendar size={18} className="inline mr-2" />
                                        {new Date(selectedDate + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
                                    </h3>
                                    {isSmartboard && <p className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">Smartboard</p>}
                                </div>

                                {dayMaterials.length > 0 ? (
                                    <div className="space-y-3">
                                        {dayMaterials.map(m => (
                                            <div key={m.id} className="group flex items-center gap-3 p-4 bg-gray-50 rounded-xl transition-all hover:bg-white hover:shadow-md border border-transparent hover:border-gray-100">
                                                <button onClick={() => handlePreview(m)} className="flex items-center gap-3 flex-1 text-left">
                                                    <div className="relative">
                                                        <FileText className="text-blue-500 flex-shrink-0" size={24} />
                                                        {m.lesson_hour && (
                                                            <span className="absolute -top-2 -right-2 bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-blue-200">
                                                                {m.lesson_hour}.
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <span className="block font-medium text-gray-800 truncate">{m.file_name}</span>
                                                        {m.lesson_hour && <span className="text-xs text-gray-500">{m.lesson_hour}. Unterrichtsstunde</span>}
                                                    </div>
                                                </button>

                                                {isSmartboard && (
                                                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => openEditModal(m)} className="p-2 hover:bg-blue-100 rounded-lg" title="Bearbeiten">
                                                            <Edit3 size={16} className="text-blue-500" />
                                                        </button>
                                                        <button onClick={() => deleteMaterial(m)} className="p-2 hover:bg-red-100 rounded-lg" title="Löschen">
                                                            <Trash2 size={16} className="text-red-500" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-gray-400">
                                        <FileText size={48} className="mx-auto mb-4 opacity-50" />
                                        <p>Keine Dateien für diesen Tag</p>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-center py-12 text-gray-400">
                                <Calendar size={48} className="mx-auto mb-4 opacity-50" />
                                <p>Wähle einen Tag im Kalender</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold">Datei hochladen</h3>
                            <button onClick={() => setShowUploadModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Dateiname</label>
                                <input
                                    type="text"
                                    value={uploadFileName}
                                    onChange={(e) => setUploadFileName(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
                                    placeholder="Name der Mitschrift"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Fach</label>
                                    <select
                                        value={uploadSubject}
                                        onChange={(e) => setUploadSubject(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
                                    >
                                        {SUBJECTS.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Stunde</label>
                                    <select
                                        value={uploadLessonHour}
                                        onChange={(e) => setUploadLessonHour(Number(e.target.value))}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
                                    >
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(h => (
                                            <option key={h} value={h}>{h}. Stunde</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <p className="text-sm text-gray-500">
                                Datum: <strong>{new Date().toLocaleDateString('de-DE')}</strong> (heute)
                            </p>

                            <button
                                onClick={confirmUpload}
                                disabled={uploading || !uploadFileName.trim()}
                                className={cn(
                                    "w-full py-4 rounded-xl font-bold text-white transition-all",
                                    uploading || !uploadFileName.trim()
                                        ? "bg-gray-300"
                                        : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                                )}
                            >
                                {uploading ? 'Uploading...' : 'Hochladen'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingMaterial && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold">Datei bearbeiten</h3>
                            <button onClick={() => setEditingMaterial(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
                                    <input
                                        type="date"
                                        value={editDate}
                                        onChange={(e) => setEditDate(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Stunde</label>
                                    <select
                                        value={editLessonHour}
                                        onChange={(e) => setEditLessonHour(Number(e.target.value))}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                                    >
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(h => (
                                            <option key={h} value={h}>{h}. Stunde</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={confirmEdit}
                                className="w-full py-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all"
                            >
                                Speichern
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {previewUrl && previewFile && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setPreviewUrl(null)}>
                    <div className="bg-white rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-gray-100">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">{previewFile.file_name}</h3>
                                <p className="text-sm text-gray-500">
                                    {previewFile.lesson_hour ? `${previewFile.lesson_hour}. Stunde • ` : ''}
                                    {new Date(previewFile.material_date).toLocaleDateString('de-DE')}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={previewUrl}
                                    download={previewFile.file_name}
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
        </main>
    );
}

export default function MaterialsPage() {
    return (
        <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
            <MaterialsContent />
        </Suspense>
    );
}
