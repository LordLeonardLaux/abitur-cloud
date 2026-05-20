'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useFriends } from '@/hooks/useFriends';
import { supabase } from '@/lib/supabase/client';
import { SUBJECTS } from '@/lib/constants';
import { ClassMaterial, Profile } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronLeft, ChevronRight, Upload, Download, FileText, Calendar, Trash2, Edit3, X, Search, Loader2, User, GraduationCap, List as ListIcon, Library, Users, Bookmark } from 'lucide-react';
import { cn, formatGrade } from '@/lib/utils';
import { Sidebar } from '@/components/dashboard/Sidebar';
import PDFViewer from '@/components/ui/PDFViewer';
import IWBViewer from '@/components/ui/IWBViewer';
import { PDFThumbnail } from '@/components/ui/PDFThumbnail';
import { ensureFileSize, withTimeout, timeoutForFile, uploadErrorMessage } from '@/lib/uploadHelpers';

// Simple debounce hook implementation if not available
function useDebounceValue<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

function MaterialsContent() {
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const { friends } = useFriends();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [friendTopicFiles, setFriendTopicFiles] = useState<any[]>([]);
    const [materials, setMaterials] = useState<ClassMaterial[]>([]);
    const [teacherMaterials, setTeacherMaterials] = useState<any[]>([]);
    const [linkedTopicFiles, setLinkedTopicFiles] = useState<any[]>([]);
    const [selectedGrade, setSelectedGrade] = useState<'12' | '13'>('13'); // Default to 13
    const [selectedSubject, setSelectedSubject] = useState<string>('all');
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'calendar' | 'list' | 'library'>('library');
    const [librarySource, setLibrarySource] = useState<'all' | 'mine' | 'friend' | 'class' | 'teacher'>('all');
    const [uploading, setUploading] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Search State
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounceValue(searchTerm, 500);

    // Filtered materials (either bye day or search results)
    const [displayMaterials, setDisplayMaterials] = useState<ClassMaterial[]>([]);

    // Preview Modal State
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewFile, setPreviewFile] = useState<ClassMaterial | null>(null);

    // Upload Modal State
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [uploadSubject, setUploadSubject] = useState('mathe');
    const [uploadFileName, setUploadFileName] = useState('');
    const [uploadLessonHour, setUploadLessonHour] = useState<number>(1);
    const [uploadGrade, setUploadGrade] = useState<'12' | '13'>('13');

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

    // Auto-set view from URL ?view=library
    useEffect(() => {
        const v = searchParams?.get('view');
        if (v === 'library' || v === 'list' || v === 'calendar') {
            setViewMode(v as any);
        }
    }, [searchParams]);

    // Fetch own + friends' topic_files (only when library view active)
    useEffect(() => {
        if (viewMode !== 'library' || !user) {
            setFriendTopicFiles([]);
            return;
        }
        let cancelled = false;
        const ownerIds = [user.id, ...friends.map((f: any) => f.id)];
        supabase
            .from('topic_files')
            .select('id, file_name, storage_path, created_at, material_date, topic:topics!inner(id, owner_id, subject_id, owner:profiles!owner_id(full_name))')
            .in('topic.owner_id', ownerIds)
            .order('created_at', { ascending: false })
            .limit(800)
            .then(({ data }) => {
                if (cancelled) return;
                setFriendTopicFiles((data || []).map((f: any) => ({
                    ...f,
                    subject_id: f.topic?.subject_id,
                    isLibraryNote: true,
                    isMine: f.topic?.owner_id === user.id,
                    ownerName: f.topic?.owner?.full_name,
                })));
            });
        return () => { cancelled = true; };
    }, [viewMode, user, friends]);

    useEffect(() => {
        const fetchMaterials = async () => {
            let query = supabase.from('class_materials').select('*');
            let teacherQuery = supabase.from('teacher_materials').select('*, teacher:profiles(*)');

            if (debouncedSearchTerm) {
                // Search Mode
                query = query.ilike('file_name', `%${debouncedSearchTerm}%`);
                teacherQuery = teacherQuery.ilike('file_name', `%${debouncedSearchTerm}%`);
            } else if (viewMode === 'list' || viewMode === 'library') {
                // List/Library Mode — load all materials, no date range
                // (only cap the result count to avoid loading thousands)
                query = query.limit(500);
                teacherQuery = teacherQuery.limit(500);
            } else {
                // Calendar Mode
                const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
                const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
                const startStr = startOfMonth.toISOString().split('T')[0];
                const endStr = endOfMonth.toISOString().split('T')[0];

                query = query.gte('material_date', startStr).lte('material_date', endStr);
                teacherQuery = teacherQuery.gte('material_date', startStr).lte('material_date', endStr);
            }

            if (selectedSubject !== 'all') {
                query = query.eq('subject_id', selectedSubject);
                teacherQuery = teacherQuery.eq('subject_id', selectedSubject);
            }

            query = query.eq('grade_level', selectedGrade).order('material_date', { ascending: false });
            teacherQuery = teacherQuery.eq('grade_level', selectedGrade).order('material_date', { ascending: false });

            const [materialsRes, teacherRes] = await Promise.all([query, teacherQuery]);

            // Join profile data for class_materials
            if (materialsRes.data) {
                const materialsWithProfiles = await Promise.all(materialsRes.data.map(async (m) => {
                    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', m.uploader_id).single();
                    return { ...m, uploader: profileData } as ClassMaterial;
                }));
                setMaterials(materialsWithProfiles);
            } else {
                setMaterials([]);
            }

            if (teacherRes.data) {
                setTeacherMaterials(teacherRes.data);
            } else {
                setTeacherMaterials([]);
            }

            // Linked topic files — student's own files that have a material_date set
            if (user) {
                let topicFilesQuery = supabase
                    .from('topic_files')
                    .select('*, topic:topics!inner(id, owner_id, subject_id, semester, title)')
                    .eq('topic.owner_id', user.id)
                    .not('material_date', 'is', null);

                if (debouncedSearchTerm) {
                    topicFilesQuery = topicFilesQuery.ilike('file_name', `%${debouncedSearchTerm}%`);
                } else if (viewMode === 'list' || viewMode === 'library') {
                    topicFilesQuery = topicFilesQuery.limit(500);
                } else {
                    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
                    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
                    const startStr = startOfMonth.toISOString().split('T')[0];
                    const endStr = endOfMonth.toISOString().split('T')[0];
                    topicFilesQuery = topicFilesQuery.gte('material_date', startStr).lte('material_date', endStr);
                }

                if (selectedSubject !== 'all') {
                    topicFilesQuery = topicFilesQuery.eq('topic.subject_id', selectedSubject);
                }

                const { data: topicFilesData } = await topicFilesQuery.order('material_date', { ascending: false });
                if (topicFilesData) {
                    // Mark these as own-linked-notes for renderer differentiation
                    setLinkedTopicFiles(topicFilesData.map((f: any) => ({
                        ...f,
                        subject_id: f.topic?.subject_id,
                        isLinkedNote: true,
                    })));
                } else {
                    setLinkedTopicFiles([]);
                }
            }
        };
        fetchMaterials();
    }, [currentMonth, selectedSubject, debouncedSearchTerm, selectedGrade, viewMode, user]);

    useEffect(() => {
        if (debouncedSearchTerm || viewMode === 'list') {
            // Search Mode or List Mode: Show all matches sorted by material_date desc
            const all = [...materials, ...teacherMaterials, ...linkedTopicFiles];
            all.sort((a: any, b: any) => {
                const da = a.material_date || '';
                const db = b.material_date || '';
                return db.localeCompare(da);
            });
            setDisplayMaterials(all);
        } else if (selectedDate) {
            // Calendar Mode: Show selected day
            const filteredStudent = materials.filter(m => m.material_date === selectedDate);
            const filteredTeacher = teacherMaterials.filter(m => m.material_date === selectedDate);
            const filteredLinked = linkedTopicFiles.filter(m => m.material_date === selectedDate);
            setDisplayMaterials([...filteredStudent, ...filteredTeacher, ...filteredLinked]);
        } else {
            // Calendar Mode: No day selected
            setDisplayMaterials([]);
        }
    }, [selectedDate, materials, teacherMaterials, linkedTopicFiles, debouncedSearchTerm, viewMode]);

    // Handle file selection - opens modal
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return; // Removed isSmartboard check so everyone can upload
        const file = e.target.files[0];
        setPendingFile(file);
        setUploadFileName(file.name.replace(/\.[^/.]+$/, '')); // Remove extension
        setUploadSubject(selectedSubject === 'all' ? 'mathe' : selectedSubject);
        setUploadLessonHour(1); // Default to 1st hour
        setUploadGrade(selectedGrade); // Default to currently viewed grade
        setShowUploadModal(true);
        e.target.value = ''; // Reset input
    };

    // Confirm upload
    const confirmUpload = async () => {
        if (!pendingFile || !user) return;

        try {
            ensureFileSize(pendingFile);
        } catch (err: any) {
            alert(err.message);
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        const fileExt = pendingFile.name.split('.').pop();
        const finalFileName = `${uploadFileName}.${fileExt}`;

        setUploading(true);
        try {
            const storageName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `materials/${uploadSubject}/${today}/${storageName}`;

            const { error: uploadError } = await withTimeout(
                supabase.storage.from('materials').upload(filePath, pendingFile),
                timeoutForFile(pendingFile)
            );
            if (uploadError) throw uploadError;

            const { error: dbError } = await withTimeout(
                supabase.from('class_materials').insert({
                    uploader_id: user.id,
                    subject_id: uploadSubject,
                    material_date: today,
                    file_name: finalFileName,
                    storage_path: filePath,
                    lesson_hour: uploadLessonHour,
                    grade_level: uploadGrade
                }),
                15_000
            );
            if (dbError) throw dbError;

            setShowUploadModal(false);
            setPendingFile(null);
            window.location.reload();
        } catch (error: any) {
            console.error('Upload failed:', error);
            alert(`Fehler: ${uploadErrorMessage(error)}`);
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
        setEditName(m.file_name.replace(/\.[^/.]+$/, ''));
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

    const handlePreview = async (m: any) => {
        const isTeacher = 'teacher' in m;
        const isLinkedNote = m.isLinkedNote;
        const bucket = isLinkedNote ? 'topic-files' : (isTeacher ? 'teacher-materials' : 'materials');
        try {
            // Using getPublicUrl instead of createSignedUrl due to server storage issues
            const { data } = supabase.storage.from(bucket).getPublicUrl(m.storage_path);
            if (data?.publicUrl) {
                setPreviewUrl(`${data.publicUrl}?t=${Date.now()}`);
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
        return materials.some(m => m.material_date === dateStr)
            || teacherMaterials.some(m => m.material_date === dateStr)
            || linkedTopicFiles.some(m => m.material_date === dateStr)
            || friendTopicFiles.some(m => m.material_date === dateStr);
    };

    const getDateString = (day: number) => {
        return `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

    return (
        <div className="flex min-h-screen bg-gray-50">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} mobileOnly />
            <div className="flex-1 flex flex-col min-w-0">
                <main className="flex-1 p-4 md:p-8">
                    <div className="max-w-6xl mx-auto space-y-8">
                        {/* Header */}
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 md:gap-6 px-2 md:px-0">
                            <div className="flex items-center gap-3 w-full lg:w-auto">
                                {/* Sidebar Menu Button */}
                                <button
                                    onClick={() => setIsSidebarOpen(true)}
                                    className="p-2 bg-white border border-gray-100 shadow-sm rounded-xl text-gray-900 active:scale-95"
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                                </button>
                                <Link href="/dashboard" className="p-2 -ml-2 rounded-full hover:bg-gray-200">
                                    <ChevronLeft className="w-6 h-6 text-gray-600" />
                                </Link>
                                <div>
                                    <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Material</h1>
                                    <p className="text-gray-500 text-xs md:text-sm">
                                        {debouncedSearchTerm ? 'Suche' : 'Alle Materialien · Kalender + Fächer'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 flex-1 lg:justify-end">
                                {/* Search Bar */}
                                <div className="relative w-full max-w-md">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Mitschriften suchen..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2.5 bg-white rounded-xl text-sm border border-gray-200 focus:ring-2 focus:ring-blue-500 shadow-sm"
                                    />
                                </div>

                                {/* Upload Button */}
                                <label className={cn(
                                    "flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer transition-all shadow-md active:scale-95 flex-shrink-0",
                                    uploading
                                        ? "bg-gray-300 text-gray-500"
                                        : "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700"
                                )}>
                                    {uploading ? <Loader2 className="animate-spin w-5 h-5" /> : <Upload className="w-5 h-5" />}
                                    <span className="font-bold hidden sm:inline">Hochladen</span>
                                    <input
                                        type="file"
                                        accept="application/pdf,image/*,.iwb"
                                        className="hidden"
                                        onChange={handleFileSelect}
                                        disabled={uploading}
                                    />
                                </label>

                            </div>
                        </div>

                        {/* Source filter pills (always visible) */}
                        <div className="flex flex-wrap gap-2 mb-3">
                            {([
                                { id: 'all' as const, label: 'Alle Quellen', icon: null },
                                { id: 'mine' as const, label: 'Eigene', icon: <User size={12} /> },
                                { id: 'friend' as const, label: 'Freunde', icon: <Users size={12} /> },
                                { id: 'class' as const, label: 'Smartboard', icon: <Bookmark size={12} /> },
                                { id: 'teacher' as const, label: 'Lehrer', icon: <GraduationCap size={12} /> },
                            ]).map((opt) => (
                                <button
                                    key={opt.id}
                                    onClick={() => setLibrarySource(opt.id)}
                                    className={cn(
                                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap',
                                        librarySource === opt.id ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400'
                                    )}
                                >
                                    {opt.icon}
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        {/* Subject Tabs - Scrollable on mobile */}
                        <div className="flex overflow-x-auto pb-2 -mx-2 px-2 md:mx-0 md:px-0 scrollbar-hide gap-2 no-scrollbar">
                            <button
                                onClick={() => { setSelectedSubject('all'); setSelectedDate(null); }}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
                                    selectedSubject === 'all'
                                        ? "bg-black text-white"
                                        : "bg-white text-gray-600 border border-gray-200 hover:border-black"
                                )}
                            >
                                Alle
                            </button>

                            <button
                                onClick={() => { setSelectedGrade('13'); setSelectedDate(null); }}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-sm font-bold transition-all border whitespace-nowrap flex items-center gap-1.5",
                                    selectedGrade === '13'
                                        ? "bg-purple-600 text-white border-purple-600 shadow-md"
                                        : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                                )}
                            >
                                Jg. 13
                                <span className={cn("text-[10px] font-medium", selectedGrade === '13' ? "text-purple-100" : "text-gray-400")}>
                                    ({formatGrade('13').split('(')[1]}
                                </span>
                            </button>
                            <button
                                onClick={() => { setSelectedGrade('12'); setSelectedDate(null); }}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-sm font-bold transition-all border whitespace-nowrap flex items-center gap-1.5",
                                    selectedGrade === '12'
                                        ? "bg-purple-600 text-white border-purple-600 shadow-md"
                                        : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                                )}
                            >
                                Jg. 12
                                <span className={cn("text-[10px] font-medium", selectedGrade === '12' ? "text-purple-100" : "text-gray-400")}>
                                    ({formatGrade('12').split('(')[1]}
                                </span>
                            </button>

                            {SUBJECTS.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => { setSelectedSubject(s.id); setSelectedDate(null); }}
                                    className={cn(
                                        "px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
                                        selectedSubject === s.id
                                            ? "bg-blue-600 text-white"
                                            : "bg-white text-gray-600 border border-gray-200 hover:border-blue-300"
                                    )}
                                >
                                    {s.name}
                                </button>
                            ))}
                        </div>

                        {/* Compact Calendar (always visible, drives date-filter) */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 md:p-4">
                            <div className="flex items-center justify-between mb-2">
                                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} className="p-1.5 hover:bg-gray-100 rounded-lg">
                                    <ChevronLeft size={18} />
                                </button>
                                <div className="flex items-center gap-3">
                                    <h2 className="text-sm md:text-base font-bold text-gray-900">
                                        {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                                    </h2>
                                    {selectedDate && (
                                        <button
                                            onClick={() => setSelectedDate(null)}
                                            className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                        >
                                            <X size={12} />
                                            Filter aus
                                        </button>
                                    )}
                                </div>
                                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} className="p-1.5 hover:bg-gray-100 rounded-lg">
                                    <ChevronRight size={18} />
                                </button>
                            </div>

                            <div className="grid grid-cols-7 gap-0.5 md:gap-1 mb-1">
                                {weekDays.map(d => (
                                    <div key={d} className="text-center text-[10px] font-bold text-gray-400 py-1">{d}</div>
                                ))}
                            </div>

                            <div className="grid grid-cols-7 gap-0.5 md:gap-1">
                                {getDaysInMonth().map((day, idx) => {
                                    const dateStr = day ? getDateString(day) : '';
                                    const isSelected = day && selectedDate === dateStr;
                                    const hasContent = day ? hasContentOnDay(day) : false;
                                    return (
                                        <button
                                            key={idx}
                                            disabled={day === null}
                                            onClick={() => day && setSelectedDate(isSelected ? null : dateStr)}
                                            className={cn(
                                                "aspect-square rounded-md flex flex-col items-center justify-center text-xs font-medium transition-all relative",
                                                day === null && "invisible",
                                                isSelected && "bg-blue-600 text-white shadow-sm",
                                                day && !isSelected && hasContent && "hover:bg-blue-50 text-gray-900",
                                                day && !isSelected && !hasContent && "hover:bg-gray-50 text-gray-400",
                                            )}
                                        >
                                            <span>{day}</span>
                                            {day && hasContent && (
                                                <div className={cn("w-1 h-1 rounded-full absolute bottom-1", isSelected ? "bg-white" : "bg-blue-500")} />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Selected-Date Banner */}
                        {selectedDate && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl text-sm">
                                <Calendar size={14} className="text-blue-600" />
                                <span className="font-semibold text-blue-700">
                                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </span>
                                <button onClick={() => setSelectedDate(null)} className="ml-auto text-blue-600 hover:text-blue-800 p-1">
                                    <X size={14} />
                                </button>
                            </div>
                        )}

                        {/* Unified Tile Grid (always visible, grouped by Fach when 'all') */}
                        <LibraryGrid
                            classMaterials={materials}
                            teacherMaterials={teacherMaterials}
                            ownTopicFiles={linkedTopicFiles}
                            friendTopicFiles={friendTopicFiles}
                            selectedSubject={selectedSubject}
                            selectedDate={selectedDate}
                            source={librarySource}
                            searchTerm={debouncedSearchTerm}
                            user={user}
                            onPreview={handlePreview}
                        />

                        {/* Hidden: legacy calendar+list view (kept for ?view=calendar / ?view=list URL compat) */}
                        <div className="hidden">
                            <div>
                                {debouncedSearchTerm || viewMode === 'list' ? (
                                    // SEARCH MODE or LIST MODE — chronological list
                                    <>
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                                {debouncedSearchTerm ? <Search size={18} /> : <ListIcon size={18} />}
                                                {debouncedSearchTerm
                                                    ? 'Suchergebnisse'
                                                    : selectedSubject === 'all'
                                                        ? 'Alle Materialien'
                                                        : `${SUBJECTS.find(s => s.id === selectedSubject)?.name || ''} — chronologisch`}
                                                <span className="text-sm font-normal text-gray-500 ml-2">
                                                    ({displayMaterials.length})
                                                </span>
                                            </h3>
                                        </div>
                                        {displayMaterials.length > 0 ? (
                                            <div className="space-y-3">
                                                {displayMaterials.map((m: any) => {
                                                    const isTeacher = !!m.teacher;
                                                    return (
                                                        <div key={m.id} className={cn(
                                                            "group flex items-center gap-3 p-4 rounded-xl transition-all hover:shadow-md border border-transparent hover:border-gray-100",
                                                            isTeacher ? "bg-amber-50 hover:bg-white" : "bg-gray-50 hover:bg-white"
                                                        )}>
                                                            <button onClick={() => handlePreview(m)} className="flex items-center gap-3 flex-1 text-left">
                                                                <PDFThumbnail
                                                                    storagePath={m.storage_path}
                                                                    bucket={m.isLinkedNote ? 'topic-files' : (isTeacher ? 'teacher-materials' : 'materials')}
                                                                    width={72}
                                                                    orientation="landscape"
                                                                    className="flex-shrink-0 shadow-sm"
                                                                />
                                                                <div className="overflow-hidden">
                                                                    <span className="block font-medium text-gray-800 truncate">{m.file_name}</span>
                                                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                                                        <span className="bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded font-bold text-[10px]">
                                                                            {new Date(m.material_date).toLocaleDateString()}
                                                                        </span>
                                                                        <span className={cn(
                                                                            "px-1.5 py-0.5 rounded uppercase font-bold text-[10px]",
                                                                            isTeacher ? "bg-amber-100 text-amber-700" : "bg-blue-50 text-blue-600"
                                                                        )}>
                                                                            {SUBJECTS.find(s => s.id === m.subject_id)?.name.substring(0, 3)}
                                                                        </span>
                                                                        {isTeacher && <span className="text-amber-600 font-bold ml-1 flex items-center gap-1"><GraduationCap size={10} /> Schulinhalte</span>}
                                                                    </div>
                                                                </div>
                                                            </button>
                                                            {((!isTeacher && (isSmartboard || user?.id === (m as any).uploader_id)) || (isTeacher && user?.id === (m as any).teacher_id)) && (
                                                                <div className="flex items-center gap-1">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); openEditModal(m); }}
                                                                        className="p-2 hover:bg-blue-100 rounded-lg text-gray-400 hover:text-blue-600"
                                                                    >
                                                                        <Edit3 size={18} />
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); deleteMaterial(m); }}
                                                                        className="p-2 hover:bg-red-100 rounded-lg text-gray-400 hover:text-red-600"
                                                                    >
                                                                        <Trash2 size={18} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-center py-12 text-gray-400">
                                                {debouncedSearchTerm ? (
                                                    <>
                                                        <Search size={48} className="mx-auto mb-4 opacity-50" />
                                                        <p>Keine Mitschriften gefunden für "{debouncedSearchTerm}"</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <FileText size={48} className="mx-auto mb-4 opacity-50" />
                                                        <p>
                                                            Keine Materialien {selectedSubject === 'all' ? 'vorhanden' : `für ${SUBJECTS.find(s => s.id === selectedSubject)?.name || 'dieses Fach'}`}
                                                        </p>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </>
                                ) : selectedDate ? (
                                    // CALENDAR MODE WITH DATE
                                    <>
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-lg font-bold text-gray-900">
                                                <Calendar size={18} className="inline mr-2" />
                                                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
                                            </h3>
                                            {isSmartboard && <p className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">Smartboard</p>}
                                        </div>

                                        {displayMaterials.length > 0 ? (
                                            <div className="space-y-3">
                                                {displayMaterials.map((m: any) => {
                                                    const isTeacher = !!m.teacher;
                                                    return (
                                                        <div key={m.id} className={cn(
                                                            "group flex items-center gap-3 p-4 rounded-xl transition-all hover:shadow-md border border-transparent hover:border-gray-100",
                                                            isTeacher ? "bg-amber-50 hover:bg-white" : "bg-gray-50 hover:bg-white"
                                                        )}>
                                                            <button onClick={() => handlePreview(m)} className="flex items-center gap-3 flex-1 text-left">
                                                                <div className="relative flex-shrink-0">
                                                                    <PDFThumbnail
                                                                        storagePath={m.storage_path}
                                                                        bucket={m.isLinkedNote ? 'topic-files' : (isTeacher ? 'teacher-materials' : 'materials')}
                                                                        width={72}
                                                                        orientation="landscape"
                                                                        className="shadow-sm"
                                                                    />
                                                                    {m.lesson_hour && (
                                                                        <span className={cn(
                                                                            "absolute -top-2 -right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full border z-10",
                                                                            isTeacher ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-blue-100 text-blue-700 border-blue-200"
                                                                        )}>
                                                                            {m.lesson_hour}.
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <span className="block font-medium text-gray-800 truncate">{m.file_name}</span>
                                                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                                                        {(selectedSubject === 'all' || isTeacher) && (
                                                                            <span className={cn(
                                                                                "px-1.5 py-0.5 rounded uppercase font-bold text-[10px]",
                                                                                isTeacher ? "bg-amber-100 text-amber-700" : "bg-blue-50 text-blue-600"
                                                                            )}>
                                                                                {SUBJECTS.find(s => s.id === m.subject_id)?.name.substring(0, 3)}
                                                                            </span>
                                                                        )}
                                                                        {m.lesson_hour && <span>{m.lesson_hour}. Std</span>}
                                                                        <span className="text-gray-300">•</span>
                                                                        <div className="flex items-center gap-1">
                                                                            {isTeacher ? <GraduationCap size={10} className="text-amber-600" /> : <User size={10} />}
                                                                            <span className={cn(isTeacher && "text-amber-700 font-bold")}>
                                                                                {isTeacher ? (m.teacher?.full_name || 'Lehrer') : (m.uploader?.full_name || 'Unbekannt')}
                                                                            </span>
                                                                        </div>
                                                                        {isTeacher && <span className="bg-amber-600 text-white px-1.5 py-0.5 rounded text-[9px] font-black uppercase">Schulinhalt</span>}
                                                                    </div>
                                                                </div>
                                                            </button>

                                                            {((!isTeacher && (isSmartboard || user?.id === (m as any).uploader_id)) || (isTeacher && user?.id === (m as any).teacher_id)) && (
                                                                <div className="flex items-center gap-1">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); openEditModal(m); }}
                                                                        className="p-2 hover:bg-blue-100 rounded-lg text-gray-400 hover:text-blue-600"
                                                                    >
                                                                        <Edit3 size={18} />
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); deleteMaterial(m); }}
                                                                        className="p-2 hover:bg-red-100 rounded-lg text-gray-400 hover:text-red-600"
                                                                    >
                                                                        <Trash2 size={18} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-center py-12 text-gray-400">
                                                <FileText size={48} className="mx-auto mb-4 opacity-50" />
                                                <p>Keine Dateien für diesen Tag</p>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    // IDLE STATE
                                    <div className="text-center py-12 text-gray-400">
                                        <Calendar size={48} className="mx-auto mb-4 opacity-50" />
                                        <p>Wähle einen Tag im Kalender oder suche oben nach Mitschriften</p>
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
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Jahrgang</label>
                                            <select
                                                value={uploadGrade}
                                                onChange={(e) => setUploadGrade(e.target.value as '12' | '13')}
                                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
                                            >
                                                <option value="13">Jahrgang 13</option>
                                                <option value="12">Jahrgang 12</option>
                                            </select>
                                        </div>
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
                                <div className="flex-1 bg-gray-100 overflow-hidden relative">
                                    {/\.iwb($|\?)/i.test(previewFile.file_name) ? (
                                        <IWBViewer url={previewUrl} fileName={previewFile.file_name} />
                                    ) : (
                                        <PDFViewer url={previewUrl} />
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

// =====================================================================
// LIBRARY GRID — single unified view with tiles grouped by Fach
// All 4 sources merged, filtered by subject + source + search + date
// =====================================================================
interface LibraryGridProps {
    classMaterials: any[];
    teacherMaterials: any[];
    ownTopicFiles: any[];
    friendTopicFiles: any[];
    selectedSubject: string;
    selectedDate: string | null;
    source: 'all' | 'mine' | 'friend' | 'class' | 'teacher';
    searchTerm: string;
    user: any;
    onPreview: (m: any) => void;
}

function LibraryGrid({ classMaterials, teacherMaterials, ownTopicFiles, friendTopicFiles, selectedSubject, selectedDate, source, searchTerm, user, onPreview }: LibraryGridProps) {
    const filteredItems = useMemo(() => {
        const cm = classMaterials.map((m: any) => ({ ...m, _src: 'class', _bucket: 'materials' }));
        const tm = teacherMaterials.map((m: any) => ({ ...m, _src: 'teacher', _bucket: 'teacher-materials', isLinkedNote: false }));
        const own = ownTopicFiles.filter((f: any) => f.isLinkedNote).map((f: any) => ({ ...f, _src: 'mine', _bucket: 'topic-files' }));
        const all = friendTopicFiles.map((f: any) => ({
            ...f,
            _src: f.isMine ? 'mine' : 'friend',
            _bucket: 'topic-files',
            isLinkedNote: true,
        }));
        const merged = [...cm, ...tm, ...all];
        const seenIds = new Set(merged.map((m) => m.id));
        own.forEach((f) => { if (!seenIds.has(f.id)) merged.push(f); });

        return merged
            .filter((it) => selectedSubject === 'all' || it.subject_id === selectedSubject)
            .filter((it) => source === 'all' || it._src === source)
            .filter((it) => !searchTerm || (it.file_name || '').toLowerCase().includes(searchTerm.toLowerCase()))
            .filter((it) => !selectedDate || (it.material_date && it.material_date === selectedDate))
            .sort((a, b) => {
                // Chronological: newest first by upload date (fallback: material_date)
                const da = a.created_at || a.material_date || '';
                const db = b.created_at || b.material_date || '';
                return db.localeCompare(da);
            });
    }, [classMaterials, teacherMaterials, ownTopicFiles, friendTopicFiles, selectedSubject, selectedDate, source, searchTerm]);

    // Group by subject when 'Alle Fächer' is selected
    const groupedBySubject = useMemo(() => {
        if (selectedSubject !== 'all') return null;
        const groups = new Map<string, any[]>();
        for (const item of filteredItems) {
            const key = item.subject_id || 'other';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(item);
        }
        const subjectOrder = SUBJECTS.map((s) => s.id);
        return Array.from(groups.entries()).sort(([a], [b]) => {
            const ia = subjectOrder.indexOf(a);
            const ib = subjectOrder.indexOf(b);
            if (ia === -1 && ib === -1) return a.localeCompare(b);
            if (ia === -1) return 1;
            if (ib === -1) return -1;
            return ia - ib;
        });
    }, [filteredItems, selectedSubject]);

    const getSourceFlag = (it: any) => {
        if (it._src === 'mine') return { name: 'Du', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: <User size={11} /> };
        if (it._src === 'friend') return { name: it.ownerName || 'Freund', color: 'bg-green-50 text-green-700 border-green-200', icon: <Users size={11} /> };
        if (it._src === 'class') return { name: it.uploader?.full_name ? `Smartboard · ${it.uploader.full_name.split(' ')[0]}` : 'Smartboard', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: <Bookmark size={11} /> };
        if (it._src === 'teacher') return { name: it.teacher?.full_name || 'Lehrer', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: <GraduationCap size={11} /> };
        return { name: '?', color: 'bg-gray-100 text-gray-600 border-gray-200', icon: null };
    };

    const formatDate = (d?: string) => {
        if (!d) return '—';
        const date = new Date(d.includes('T') ? d : d + 'T00:00:00');
        return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
    };

    if (filteredItems.length === 0) {
        return (
            <div className="text-center py-20 text-gray-400">
                <Library size={48} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm">Keine Materialien gefunden</p>
                <p className="text-xs mt-1">{selectedDate ? 'Anderen Tag wählen oder Datum zurücksetzen' : 'Filter anpassen oder Suche zurücksetzen'}</p>
            </div>
        );
    }

    const renderTile = (it: any) => {
        const flag = getSourceFlag(it);
        return (
            <button
                key={`${it._src}-${it.id}`}
                onClick={() => onPreview({ ...it, isLinkedNote: it._bucket === 'topic-files', teacher: it._src === 'teacher' ? it.teacher : undefined })}
                className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-blue-200 transition-all overflow-hidden text-left active:scale-[0.98] flex flex-col"
            >
                <div className="aspect-[4/3] bg-gray-50 flex items-center justify-center overflow-hidden border-b border-gray-100 relative">
                    <PDFThumbnail
                        storagePath={it.storage_path}
                        bucket={it._bucket}
                        width={240}
                        orientation="landscape"
                        className="!rounded-none !border-0 !shadow-none"
                    />
                    <span className={cn(
                        'absolute top-2 left-2 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border backdrop-blur-sm bg-white/90 max-w-[calc(100%-1rem)]',
                        flag.color
                    )}>
                        {flag.icon}
                        <span className="truncate">{flag.name}</span>
                    </span>
                </div>
                <div className="p-2.5 flex-1 flex flex-col justify-between gap-1">
                    <p className="text-xs md:text-sm font-semibold text-gray-900 line-clamp-2 leading-tight" title={it.file_name}>
                        {it.file_name}
                    </p>
                    <p className="text-[10px] text-gray-400">
                        {formatDate(it.material_date || it.created_at)}
                    </p>
                </div>
            </button>
        );
    };

    // Subject-grouped view (when 'Alle Fächer' is selected)
    if (groupedBySubject) {
        return (
            <div className="space-y-8">
                {groupedBySubject.map(([subjectId, items]) => {
                    const subj = SUBJECTS.find((s) => s.id === subjectId);
                    return (
                        <section key={subjectId}>
                            <div className="flex items-baseline gap-3 mb-3 px-1">
                                <h2 className="text-lg font-bold text-gray-900">{subj?.name || subjectId || 'Sonstige'}</h2>
                                <span className="text-sm text-gray-400 font-medium">{items.length}</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                                {items.map(renderTile)}
                            </div>
                        </section>
                    );
                })}
            </div>
        );
    }

    // Single-subject flat grid
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {filteredItems.map(renderTile)}
        </div>
    );
}

export default function MaterialsPage() {
    return (
        <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
            <MaterialsContent />
        </Suspense>
    );
}
