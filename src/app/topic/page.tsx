'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SUBJECTS } from '@/lib/constants';
import { Topic, TopicFile } from '@/lib/types';
import { ChevronLeft, ChevronRight, Plus, Upload, Trash2, File as FileIcon, Menu, X, ThumbsUp, ScanLine, Image, FolderOpen } from 'lucide-react';
import { EditToggle } from '@/components/ui/EditToggle';
import { cn } from '@/lib/utils';
import { Sidebar } from '@/components/dashboard/Sidebar';
import PDFViewer from '@/components/ui/PDFViewer';
import { awardUploadXP, voteUseful, getUserVotes } from '@/services/xpService';
import { isMobile } from '@/lib/platform';

function TopicMain() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { user, profile, setProfile } = useAuth();

    const idParam = searchParams.get('id'); // Topic ID
    const teacherMaterialId = searchParams.get('teacherMaterial'); // Teacher Material ID
    const subjectId = searchParams.get('subjectId');
    const semester = searchParams.get('semester');
    const isEditMode = searchParams.get('edit') === 'true';

    const [topic, setTopic] = useState<Topic | null>(null);
    const [teacherMaterial, setTeacherMaterial] = useState<any | null>(null);
    const [files, setFiles] = useState<TopicFile[]>([]);
    const [selectedFileIndex, setSelectedFileIndex] = useState<number>(-1);
    const [loading, setLoading] = useState(true);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [customTitle, setCustomTitle] = useState('');
    const [siblingTopics, setSiblingTopics] = useState<Topic[]>([]);
    const [totalTopics, setTotalTopics] = useState(0);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const handleTopicUsefulVote = async () => {
        if (!user || !topic || votedFiles.has(topic.id)) return;

        try {
            await voteUseful(user.id, topic.id, topic.owner_id, 'topic');
            setVotedFiles(prev => {
                const updated = new Set(prev);
                updated.add(topic.id);
                return updated;
            });
            // Show toast or UI feedback (handled silently for now or we can add a simple console log)
            console.log("Voted topic as useful!");
        } catch (error) {
            console.error("Error voting:", error);
        }
    };
    const [showFileList, setShowFileList] = useState(false);
    const [votedFiles, setVotedFiles] = useState<Set<string>>(new Set());
    const [votingFileId, setVotingFileId] = useState<string | null>(null);
    const [showUploadMenu, setShowUploadMenu] = useState(false);

    const subject = SUBJECTS.find((s) => s.id === subjectId);

    // Determine ownership to show/hide Edit features
    const isOwner = topic ? user?.id === topic.owner_id : false;
    const isFriendMaterial = topic ? user?.id !== topic.owner_id : false;

    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            setLoading(true);

            if (idParam) {
                // FETCH STUDENT TOPIC
                const { data: topicData } = await supabase
                    .from('topics')
                    .select('*')
                    .eq('id', idParam)
                    .single();

                if (topicData) {
                    setTopic(topicData);
                    setCustomTitle(topicData.title);

                    const { data: siblings } = await supabase
                        .from('topics')
                        .select('*')
                        .eq('owner_id', topicData.owner_id)
                        .eq('subject_id', subjectId)
                        .eq('semester', semester)
                        .order('index');
                    if (siblings) {
                        setSiblingTopics(siblings);
                        setTotalTopics(siblings.length);
                    }
                }

                const { data: filesData } = await supabase
                    .from('topic_files')
                    .select('*')
                    .eq('topic_id', idParam)
                    .order('created_at', { ascending: false });

                if (filesData) {
                    setFiles(filesData);
                    if (filesData.length > 0) setSelectedFileIndex(0);
                }
            } else if (teacherMaterialId) {
                // FETCH TEACHER MATERIAL
                const { data: matData, error } = await supabase
                    .from('teacher_materials')
                    .select('*, teacher:profiles(*)')
                    .eq('id', teacherMaterialId)
                    .single();

                if (matData) {
                    setTeacherMaterial(matData);
                    setCustomTitle(matData.file_name);

                    // For teacher material, we just show the one file
                    setFiles([{
                        id: matData.id,
                        topic_id: '',
                        file_name: matData.file_name,
                        storage_path: matData.storage_path,
                        created_at: matData.created_at
                    }]);
                    setSelectedFileIndex(0);
                } else {
                    console.error("Teacher material not found:", error);
                }
            }

            setLoading(false);

            // Load existing votes
            if (user?.id) {
                getUserVotes(user.id).then(votes => {
                    setVotedFiles(new Set(votes));
                }).catch(err => console.error('Load votes error:', err));
            }
        };
        fetchData();
    }, [idParam, teacherMaterialId, user, subjectId, semester]);

    useEffect(() => {
        const loadPdf = async () => {
            if (selectedFileIndex !== -1 && files[selectedFileIndex]) {
                const storagePath = files[selectedFileIndex].storage_path;
                const bucket = teacherMaterialId ? 'teacher-materials' : 'topic-files';

                console.log('[PDF] Getting Public URL for bucket:', bucket, 'path:', storagePath);

                const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);

                if (data?.publicUrl) {
                    // Force refresh with timestamp to avoid caching issues
                    const url = `${data.publicUrl}?t=${Date.now()}`;
                    console.log('[PDF] URL set to:', url);
                    setPdfUrl(url);
                } else {
                    console.error('[PDF] Could not get public URL');
                    setPdfUrl(null);
                }
            } else {
                setPdfUrl(null);
            }
        };

        loadPdf();
    }, [selectedFileIndex, files, teacherMaterialId]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setShowUploadMenu(false);
        if (!e.target.files || !e.target.files[0] || !topic) return;
        const file = e.target.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `${user?.id}/${subjectId}/${semester}/${idParam}/${fileName}`;

        console.log("Starting upload:", filePath);

        const { error: uploadError } = await supabase.storage.from('topic-files').upload(filePath, file);
        if (uploadError) {
            console.error("Storage upload error:", uploadError);
            alert(`Upload Fehler (Storage): ${uploadError.message}`);
            return;
        }

        console.log("Storage upload successful, inserting into database...");

        const { data: newFile, error: insertError } = await supabase.from('topic_files').insert({
            topic_id: idParam,
            file_name: file.name,
            storage_path: filePath
        }).select().single();

        if (insertError) {
            console.error("Database insert error:", insertError);
            alert(`Upload Fehler (Datenbank): ${insertError.message}`);
            return;
        }

        if (newFile) {
            console.log("Database insert successful:", newFile);
            setFiles([newFile, ...files]);
            if (selectedFileIndex === -1) setSelectedFileIndex(0);

            // Award XP for upload
            if (user?.id) {
                awardUploadXP(user.id).then(newXp => {
                    if (newXp > 0) {
                        setProfile(prev => prev ? { ...prev, xp: newXp } : prev);
                    }
                }).catch(err => console.error('XP award error:', err));
            }
        }
    };

    const handleDelete = async (fileId: string, storagePath: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Löschen?')) return;
        await supabase.storage.from('topic-files').remove([storagePath]);
        await supabase.from('topic_files').delete().eq('id', fileId);
        setFiles(files.filter(f => f.id !== fileId));
    };

    const handleRename = async (newTitle: string) => {
        setCustomTitle(newTitle);
        if (!topic) return;
        await supabase.from('topics').update({ title: newTitle }).eq('id', topic.id);
        setTopic({ ...topic, title: newTitle });
        setIsEditingTitle(false);
    };

    // handleScan was removed in favor of standard HTML5 camera input (capture="environment") in the UI below.

    if (loading) return <div className="p-10 text-center flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>; if ((!topic && !teacherMaterial) || !subject) return <div className="p-10 text-center">Not found</div>;

    const currentIndex = topic ? siblingTopics.findIndex(t => t.id === topic.id) : -1;
    const title = topic ? topic.title : teacherMaterial?.file_name;
    const currentFile = selectedFileIndex !== -1 ? files[selectedFileIndex] : null;

    return (
        <>
            <main className="h-screen flex flex-col bg-white overflow-hidden">
                {/* Standardized Header */}
                <div className="bg-white border-b border-gray-100 flex-shrink-0 relative z-40">
                    <div className="max-w-[1600px] mx-auto px-3 py-2.5 flex items-center justify-between gap-2">
                        {/* LEFT: Back Button + Title */}
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Link href={`/subject?id=${subjectId}`} className="p-1.5 -ml-1 rounded-full hover:bg-gray-100 transition-colors shrink-0">
                                <ChevronLeft className="w-5 h-5 text-gray-600" />
                            </Link>
                            <div className="flex flex-col min-w-0 flex-1">
                                {isEditMode && isEditingTitle ? (
                                    <input
                                        autoFocus
                                        className="text-base md:text-lg font-bold outline-none border-b-2 border-blue-500 bg-transparent w-full"
                                        value={customTitle}
                                        onChange={e => setCustomTitle(e.target.value)}
                                        onBlur={() => handleRename(customTitle)}
                                        onKeyDown={e => e.key === 'Enter' && handleRename(customTitle)}
                                    />
                                ) : (
                                    <h1
                                        onClick={() => isEditMode && setIsEditingTitle(true)}
                                        className={cn("text-base md:text-lg font-bold truncate", isEditMode && "cursor-pointer hover:text-blue-600")}
                                    >
                                        {title}
                                    </h1>
                                )}
                                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold truncate">
                                    {subject.name} • {semester}
                                </p>
                            </div>
                        </div>

                        {/* RIGHT: Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                            {/* File List Toggle (Mobile only, now smaller and cleaner) */}
                            <button
                                onClick={() => setShowFileList(!showFileList)}
                                className={cn(
                                    "md:hidden p-1.5 rounded-lg transition-all border",
                                    showFileList ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-blue-600"
                                )}
                            >
                                <FileIcon size={18} />
                            </button>

                            {/* Edit Toggle (Fertig / Bearbeiten) ONLY for owners */}
                            {isOwner && <EditToggle />}

                            {/* Nützlich Button for friends' materials */}
                            {isFriendMaterial && topic && (
                                <button
                                    onClick={handleTopicUsefulVote}
                                    disabled={votedFiles.has(topic.id)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5",
                                        votedFiles.has(topic.id)
                                            ? "bg-green-100 text-green-700 cursor-default"
                                            : "bg-blue-50 text-blue-600 hover:bg-blue-100 active:scale-95 border border-blue-100"
                                    )}
                                >
                                    <ThumbsUp size={16} className={votedFiles.has(topic.id) ? "fill-current" : ""} />
                                    <span className="hidden sm:inline">
                                        {votedFiles.has(topic.id) ? 'Als Nützlich markiert' : 'Nützlich (3 XP)'}
                                    </span>
                                </button>
                            )}

                            {/* Options Menu (Uploads, Scanner, Burger) ONLY for owners */}
                            {isOwner && (
                                <div className="relative">
                                    <button
                                        onClick={() => setShowUploadMenu(!showUploadMenu)}
                                        className="p-1.5 bg-gray-50 text-gray-900 rounded-lg hover:bg-gray-100 transition-all active:scale-95 border border-gray-100 flex items-center gap-1"
                                    >
                                        <Menu size={20} />
                                    </button>

                                    {showUploadMenu && (
                                        <>
                                            {/* Full screen backdrop */}
                                            <div className="fixed inset-0 z-[50]" onClick={() => setShowUploadMenu(false)} />

                                            {/* Dropdown Menu */}
                                            <div className="absolute right-0 top-full mt-2 z-[60] w-56 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">

                                                {/* Sub-Menu: Adding files */}
                                                {isEditMode && (
                                                    <div className="p-2 bg-gray-50 border-b border-gray-100">
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">Hinzufügen</span>
                                                    </div>
                                                )}

                                                {isEditMode && (
                                                    <>
                                                        {isMobile() && (
                                                            <label className="relative flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-100 cursor-pointer transition-colors text-sm font-semibold text-gray-700">
                                                                <div className="p-1.5 bg-purple-100 text-purple-600 rounded-lg">
                                                                    <ScanLine size={16} />
                                                                </div>
                                                                Dokument fotografieren
                                                                <input type="file" accept="image/*" capture="environment" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={handleUpload} />
                                                            </label>
                                                        )}

                                                        <label className="relative flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-100 cursor-pointer transition-colors text-sm font-semibold text-gray-700">
                                                            <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                                                                <FolderOpen size={16} />
                                                            </div>
                                                            Dateien hochladen
                                                            <input type="file" accept="application/pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={handleUpload} />
                                                        </label>

                                                        <label className="relative flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-100 cursor-pointer transition-colors text-sm font-semibold text-gray-700">
                                                            <div className="p-1.5 bg-green-100 text-green-600 rounded-lg">
                                                                <Image size={16} />
                                                            </div>
                                                            Aus Galerie wählen
                                                            <input type="file" accept="image/png,image/jpeg,image/jpg" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={handleUpload} />
                                                        </label>
                                                    </>
                                                )}

                                                {/* Navigation Section */}
                                                <div className="p-2 bg-gray-50 border-t border-b border-gray-100">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">Navigation</span>
                                                </div>

                                                <button
                                                    onClick={() => {
                                                        setShowUploadMenu(false);
                                                        setIsSidebarOpen(true);
                                                    }}
                                                    className="md:hidden flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
                                                >
                                                    <div className="p-1.5 bg-gray-200 text-gray-600 rounded-lg">
                                                        <Menu size={16} />
                                                    </div>
                                                    Hauptmenü
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden relative">
                    {/* File Sidebar - Responsive */}
                    <aside className={cn(
                        "absolute md:relative z-30 h-full w-64 border-r border-gray-100 flex flex-col bg-white transition-transform duration-300 md:translate-x-0",
                        showFileList ? "translate-x-0 shadow-2xl" : "-translate-x-full"
                    )}>
                        <div className="p-4 border-b border-gray-50 flex items-center justify-between">
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Dateien (Nur Lesen)</h3>
                            <button onClick={() => setShowFileList(false)} className="md:hidden p-1.5 text-gray-400 hover:text-gray-600">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                            {files.map((file, idx) => (
                                <button
                                    key={file.id}
                                    onClick={() => { setSelectedFileIndex(idx); setShowFileList(false); }}
                                    className={cn(
                                        "w-full group relative flex items-center gap-3 p-3 rounded-xl text-left transition-all",
                                        selectedFileIndex === idx
                                            ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
                                            : "text-gray-500 hover:bg-gray-50"
                                    )}
                                >
                                    <div className={cn("p-2 rounded-lg", selectedFileIndex === idx ? "bg-white shadow-sm" : "bg-gray-100")}>
                                        <FileIcon size={16} />
                                    </div>
                                    <span className="text-sm font-semibold truncate flex-1">{file.file_name}</span>

                                    {/* Nützlich Vote Button */}
                                    {!isEditMode && topic && topic.owner_id !== user?.id && (
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (!user || votedFiles.has(file.id) || votingFileId === file.id) return;
                                                setVotingFileId(file.id);
                                                voteUseful(user.id, file.id, topic.owner_id, 'topic_file').then(result => {
                                                    if (result.success || result.alreadyVoted) {
                                                        setVotedFiles(prev => new Set([...prev, file.id]));
                                                    }
                                                }).finally(() => setVotingFileId(null));
                                            }}
                                            className={cn(
                                                "p-1.5 rounded-md transition-all",
                                                votedFiles.has(file.id)
                                                    ? "text-green-500 bg-green-50"
                                                    : "text-gray-300 hover:text-green-500 hover:bg-green-50 md:opacity-0 md:group-hover:opacity-100"
                                            )}
                                            title={votedFiles.has(file.id) ? 'Bereits als nützlich markiert' : 'Als nützlich markieren (+3 XP)'}
                                        >
                                            <ThumbsUp size={12} />
                                        </div>
                                    )}

                                    {isEditMode && (
                                        <div
                                            onClick={(e) => handleDelete(file.id, file.storage_path, e)}
                                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md md:opacity-0 md:group-hover:opacity-100"
                                        >
                                            <Trash2 size={12} />
                                        </div>
                                    )}
                                </button>
                            ))}
                            {files.length === 0 && (
                                <div className="flex flex-col items-center justify-center p-8 text-center">
                                    <FileIcon size={32} className="text-gray-200 mb-2" />
                                    <p className="text-xs text-gray-400">Keine Dateien vorhanden.</p>
                                </div>
                            )}
                        </div>
                    </aside>

                    {/* Mobile Sidebar Overlay */}
                    {showFileList && (
                        <div className="md:hidden absolute inset-0 bg-black/20 backdrop-blur-sm z-20" onClick={() => setShowFileList(false)} />
                    )}

                    {/* Main Content (PDF) */}
                    <div className="flex-1 min-h-0 bg-gray-50 relative flex flex-col overflow-hidden">
                        {topic && siblingTopics.length > 0 && (
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4 px-4 py-2 bg-white/95 backdrop-blur-md rounded-full shadow-lg border border-gray-100">
                                <button
                                    onClick={() => {
                                        const direction = 'prev';
                                        const currentIndex = siblingTopics.findIndex(t => t.id === topic.id);
                                        if (currentIndex > 0) {
                                            const nextTopicId = siblingTopics[currentIndex - 1].id;
                                            router.push(`/topic?subjectId=${subjectId}&semester=${semester}&id=${nextTopicId}${isEditMode ? '&edit=true' : ''}`);
                                        }
                                    }}
                                    disabled={currentIndex <= 0}
                                    className="p-1 hover:text-blue-600 disabled:text-gray-200 transition-colors"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <span className="text-[10px] font-black text-gray-500 min-w-[70px] text-center uppercase tracking-tighter">
                                    Thema {currentIndex + 1} / {totalTopics}
                                </span>
                                <button
                                    onClick={() => {
                                        const direction = 'next';
                                        const currentIndex = siblingTopics.findIndex(t => t.id === topic.id);
                                        if (currentIndex < siblingTopics.length - 1) {
                                            const nextTopicId = siblingTopics[currentIndex + 1].id;
                                            router.push(`/topic?subjectId=${subjectId}&semester=${semester}&id=${nextTopicId}${isEditMode ? '&edit=true' : ''}`);
                                        }
                                    }}
                                    disabled={currentIndex >= totalTopics - 1}
                                    className="p-1 hover:text-blue-600 disabled:text-gray-200 transition-colors"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        )}

                        <div className="flex-1 min-h-0 w-full overflow-hidden relative">
                            {files.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center p-6 bg-gray-50 text-center">
                                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                                        <FileIcon className="w-10 h-10 text-blue-500" />
                                    </div>
                                    <h2 className="text-xl font-bold text-gray-900 mb-2">Noch keine Dokumente</h2>
                                    <p className="text-gray-500 mb-8 max-w-sm">
                                        Lade eine PDF hoch oder scanne ein Dokument direkt mit der Kamera, um es diesem Thema hinzuzufügen.
                                    </p>

                                    {isEditMode && (
                                        <div className="flex flex-col gap-3 w-full max-w-xs">
                                            {isMobile() && (
                                                <label className="flex items-center justify-center gap-3 w-full sm:w-auto px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl font-bold text-base hover:scale-105 transition-all shadow-xl shadow-purple-500/30 cursor-pointer">
                                                    <ScanLine size={24} />
                                                    Dokument fotografieren
                                                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleUpload} />
                                                </label>
                                            )}

                                            <label className="cursor-pointer w-full flex items-center justify-center gap-2 bg-white text-gray-900 border border-gray-200 rounded-xl px-5 py-4 font-bold hover:bg-gray-50 transition-all active:scale-[0.98]">
                                                <FolderOpen size={20} className="text-blue-500" />
                                                PDF Hochladen
                                                <input type="file" accept="application/pdf" className="hidden" onChange={handleUpload} />
                                            </label>

                                            <label className="cursor-pointer w-full flex items-center justify-center gap-2 bg-white text-gray-900 border border-gray-200 rounded-xl px-5 py-4 font-bold hover:bg-gray-50 transition-all active:scale-[0.98]">
                                                <Image size={20} className="text-green-500" />
                                                Aus Galerie wählen
                                                <input type="file" accept="image/png,image/jpeg,image/jpg" className="hidden" onChange={handleUpload} />
                                            </label>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <PDFViewer
                                        url={pdfUrl}
                                        topicId={idParam || undefined}
                                    />

                                    {/* Floating Action Button (FAB) for 'Nützlich' */}
                                    {currentFile && !isEditMode && topic && topic.owner_id !== user?.id && profile?.rank_visible !== false && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (!user || votedFiles.has(currentFile.id) || votingFileId === currentFile.id) return;
                                                setVotingFileId(currentFile.id);
                                                voteUseful(user.id, currentFile.id, topic.owner_id, 'topic_file').then(result => {
                                                    if (result.success || result.alreadyVoted) {
                                                        setVotedFiles(prev => new Set([...prev, currentFile.id]));
                                                    }
                                                }).finally(() => setVotingFileId(null));
                                            }}
                                            className={cn(
                                                "fixed bottom-24 right-4 md:bottom-10 md:right-10 z-[60] flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full shadow-2xl transition-all active:scale-95 group",
                                                votedFiles.has(currentFile.id)
                                                    ? "bg-green-500 text-white shadow-green-500/30 ring-4 ring-green-50"
                                                    : "bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-1"
                                            )}
                                            title={votedFiles.has(currentFile.id) ? 'Bereits bewertet' : 'Hilfreich (+3 XP)'}
                                        >
                                            <ThumbsUp size={28} className={cn("transition-transform", votedFiles.has(currentFile.id) ? "fill-white" : "group-hover:rotate-12")} strokeWidth={votedFiles.has(currentFile.id) ? 2 : 2.5} />

                                            {/* XP Badge */}
                                            {!votedFiles.has(currentFile.id) && (
                                                <span className="absolute -top-2 -right-2 bg-pink-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm border-2 border-white">
                                                    +3 XP
                                                </span>
                                            )}
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Navigation Sidebar - Outside main to prevent layout collapse */}
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        </>
    );
}

export default function TopicPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
            <TopicMain />
        </Suspense>
    );
}
