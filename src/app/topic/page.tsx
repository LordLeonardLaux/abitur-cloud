'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SUBJECTS } from '@/lib/constants';
import { Topic, TopicFile } from '@/lib/types';
import { ChevronLeft, ChevronRight, Plus, Trash2, File as FileIcon, X, ThumbsUp, ScanLine, Image, FolderOpen, FileText, StickyNote, PenTool, Link2, Calendar as CalendarIcon } from 'lucide-react';
import { EditToggle } from '@/components/ui/EditToggle';
import { cn } from '@/lib/utils';
import { Sidebar } from '@/components/dashboard/Sidebar';
import PDFViewer from '@/components/ui/PDFViewer';
import IWBViewer from '@/components/ui/IWBViewer';
import { ensureFileSize, withTimeout, timeoutForFile, uploadErrorMessage } from '@/lib/uploadHelpers';
import NoteEditor from '@/components/notes/NoteEditor';
import NoteTemplatePicker, { NoteTemplate } from '@/components/notes/NoteTemplates';
import { useNotes } from '@/hooks/useNotes';
import { Note } from '@/lib/noteTypes';
import { awardUploadXP, voteUseful, getUserVotes } from '@/services/xpService';
import { isMobile } from '@/lib/platform';

type SidebarTab = 'files' | 'notes';

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

    // Calendar linking state
    const [linkingFile, setLinkingFile] = useState<TopicFile | null>(null);
    const [linkDate, setLinkDate] = useState<string>('');
    const [linkSaving, setLinkSaving] = useState(false);

    const openLinkModal = (file: TopicFile, e: React.MouseEvent) => {
        e.stopPropagation();
        setLinkingFile(file);
        setLinkDate(file.material_date || new Date().toISOString().split('T')[0]);
    };

    const closeLinkModal = () => {
        setLinkingFile(null);
        setLinkDate('');
    };

    const saveFileDate = async (date: string | null) => {
        if (!linkingFile) return;
        setLinkSaving(true);
        try {
            const { error } = await supabase
                .from('topic_files')
                .update({ material_date: date })
                .eq('id', linkingFile.id);
            if (error) throw error;
            setFiles(prev => prev.map(f => f.id === linkingFile.id ? { ...f, material_date: date } : f));
            closeLinkModal();
        } catch (err: any) {
            alert(`Fehler: ${err.message || 'Konnte Datum nicht speichern'}`);
        } finally {
            setLinkSaving(false);
        }
    };

    const handleTopicUsefulVote = async () => {
        if (!user || !topic || votedFiles.has(topic.id)) return;
        try {
            await voteUseful(user.id, topic.id, topic.owner_id, 'topic');
            setVotedFiles(prev => {
                const updated = new Set(prev);
                updated.add(topic.id);
                return updated;
            });
        } catch (error) {
            console.error("Error voting:", error);
        }
    };

    const [showFileList, setShowFileList] = useState(false);
    const [votedFiles, setVotedFiles] = useState<Set<string>>(new Set());
    const [votingFileId, setVotingFileId] = useState<string | null>(null);
    const [showUploadMenu, setShowUploadMenu] = useState(false);
    const [selectedContent, setSelectedContent] = useState<
        { type: 'file'; index: number } | { type: 'note'; noteId: string } | null
    >(null);

    // New state for redesign
    const [sidebarTab, setSidebarTab] = useState<SidebarTab>('files');
    const [showFabMenu, setShowFabMenu] = useState(false);

    const { notes, loading: notesLoading, addNote, removeNote, updateNoteInList } = useNotes(idParam);

    const subject = SUBJECTS.find((s) => s.id === subjectId);

    // Determine ownership to show/hide Edit features
    const isOwner = topic ? user?.id === topic.owner_id : false;
    const isFriendMaterial = topic ? user?.id !== topic.owner_id : false;

    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            setLoading(true);

            if (idParam) {
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
                    if (filesData.length > 0) {
                        setSelectedFileIndex(0);
                        setSelectedContent({ type: 'file', index: 0 });
                    }
                }
            } else if (teacherMaterialId) {
                const { data: matData, error } = await supabase
                    .from('teacher_materials')
                    .select('*, teacher:profiles(*)')
                    .eq('id', teacherMaterialId)
                    .single();

                if (matData) {
                    setTeacherMaterial(matData);
                    setCustomTitle(matData.file_name);

                    setFiles([{
                        id: matData.id,
                        topic_id: '',
                        file_name: matData.file_name,
                        storage_path: matData.storage_path,
                        created_at: matData.created_at
                    }]);
                    setSelectedFileIndex(0);
                    setSelectedContent({ type: 'file', index: 0 });
                } else {
                    console.error("Teacher material not found:", error);
                }
            }

            setLoading(false);

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

                const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);

                if (data?.publicUrl) {
                    const url = `${data.publicUrl}?t=${Date.now()}`;
                    setPdfUrl(url);
                } else {
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
        setShowFabMenu(false);
        if (!e.target.files || !e.target.files[0] || !topic) return;
        const file = e.target.files[0];

        try {
            ensureFileSize(file);
        } catch (err: any) {
            alert(err.message);
            return;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `${user?.id}/${subjectId}/${semester}/${idParam}/${fileName}`;

        let uploadError: any = null;
        try {
            const result = await withTimeout(
                supabase.storage.from('topic-files').upload(filePath, file),
                timeoutForFile(file)
            );
            uploadError = result.error;
        } catch (err: any) {
            alert(`Upload Fehler: ${uploadErrorMessage(err)}`);
            return;
        }
        if (uploadError) {
            alert(`Upload Fehler (Storage): ${uploadErrorMessage(uploadError)}`);
            return;
        }

        const { data: newFile, error: insertError } = await supabase.from('topic_files').insert({
            topic_id: idParam,
            file_name: file.name,
            storage_path: filePath
        }).select().single();

        if (insertError) {
            alert(`Upload Fehler (Datenbank): ${uploadErrorMessage(insertError)}`);
            return;
        }

        if (newFile) {
            setFiles([newFile, ...files]);
            setSelectedFileIndex(0);
            setSelectedContent({ type: 'file', index: 0 });

            // Auto-rename topic to file name if topic still has default name "Thema N"
            if (topic && /^Thema \d+$/.test(topic.title)) {
                const baseName = file.name.replace(/\.[^/.]+$/, '');
                await supabase.from('topics').update({ title: baseName }).eq('id', topic.id);
                setTopic({ ...topic, title: baseName });
            }

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

    const handleCreateNote = () => {
        setShowUploadMenu(false);
        setShowFabMenu(false);
        setSelectedContent({ type: 'template-picker' } as any);
        setSelectedFileIndex(-1);
    };

    const handleCreateDrawing = async () => {
        setShowUploadMenu(false);
        setShowFabMenu(false);
        if (!idParam) return;
        const note = await addNote(idParam, 'Neue Zeichnung', 'drawing');
        if (note) {
            setSelectedContent({ type: 'note', noteId: note.id });
            setSelectedFileIndex(-1);
        }
    };

    const handleSelectTemplate = async (template: NoteTemplate) => {
        if (!idParam) return;
        const title = template.id === 'blank' ? 'Neue Notiz' : template.title;
        const content = Object.keys(template.content).length > 0 ? template.content as Record<string, unknown> : undefined;
        const note = await addNote(idParam, title, 'richtext', content);
        if (note) {
            setSelectedContent({ type: 'note', noteId: note.id });
            setSelectedFileIndex(-1);
        }
    };

    const handleDeleteNote = async (noteId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Notiz löschen?')) return;
        await removeNote(noteId);
        if (selectedContent?.type === 'note' && selectedContent.noteId === noteId) {
            setSelectedContent(files.length > 0 ? { type: 'file', index: 0 } : null);
            setSelectedFileIndex(files.length > 0 ? 0 : -1);
        }
    };

    if (loading) return <div className="p-10 text-center flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
    if ((!topic && !teacherMaterial) || !subject) return <div className="p-10 text-center">Not found</div>;

    const currentIndex = topic ? siblingTopics.findIndex(t => t.id === topic.id) : -1;
    const title = topic ? topic.title : teacherMaterial?.file_name;
    const currentFile = selectedFileIndex !== -1 ? files[selectedFileIndex] : null;

    // Subject color from constants
    const subjectColor = (subject as any)?.color || '#3b82f6';

    return (
        <>
            <main
                className="fixed inset-0 flex flex-col bg-[#f5f5f7] overflow-hidden"
                style={{
                    height: '100dvh',
                    paddingTop: 'env(safe-area-inset-top, 0px)',
                }}
            >
                {/* ================================================================
                    HEADER - Breadcrumb Style
                ================================================================ */}
                <header className="glass-nav flex-shrink-0 relative z-40">
                    <div className="max-w-[1800px] mx-auto px-3 py-2 flex items-center justify-between gap-2">
                        {/* Left: Burger + Back + Breadcrumb */}
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                            <button
                                onClick={() => setIsSidebarOpen(true)}
                                className="p-1.5 rounded-lg hover:bg-black/5 transition-all active:scale-95 shrink-0"
                                title="Hauptmenü"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                            </button>

                            <Link href={`/subject?id=${subjectId}`} className="p-1 rounded-lg hover:bg-black/5 transition-colors shrink-0">
                                <ChevronLeft size={20} className="text-gray-500" />
                            </Link>

                            {/* Breadcrumb */}
                            <nav className="flex items-center gap-1 text-sm min-w-0">
                                <span
                                    className="font-semibold shrink-0 px-2 py-0.5 rounded-md hidden sm:inline"
                                    style={{ color: subjectColor, backgroundColor: `${subjectColor}15` }}
                                >
                                    {subject.name}
                                </span>
                                <ChevronRight size={14} className="text-gray-300 shrink-0 hidden sm:block" />
                                <span className="text-gray-400 shrink-0 hidden sm:inline">{semester}</span>
                                <ChevronRight size={14} className="text-gray-300 shrink-0 hidden sm:block" />

                                {/* Title - editable */}
                                {isEditMode && isEditingTitle ? (
                                    <input
                                        autoFocus
                                        className="text-sm font-bold outline-none border-b-2 border-blue-500 bg-transparent min-w-[120px]"
                                        value={customTitle}
                                        onChange={e => setCustomTitle(e.target.value)}
                                        onBlur={() => handleRename(customTitle)}
                                        onKeyDown={e => e.key === 'Enter' && handleRename(customTitle)}
                                    />
                                ) : (
                                    <span
                                        onClick={() => isEditMode && setIsEditingTitle(true)}
                                        className={cn(
                                            "font-bold text-gray-900 truncate",
                                            isEditMode && "cursor-pointer hover:text-blue-600"
                                        )}
                                    >
                                        {title}
                                    </span>
                                )}
                            </nav>

                            {/* Mobile: Subject + Semester below */}
                            <span
                                className="sm:hidden text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ml-1"
                                style={{ color: subjectColor, backgroundColor: `${subjectColor}15` }}
                            >
                                {subject.name}
                            </span>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                            {/* File List Toggle (Mobile/Tablet) */}
                            <button
                                onClick={() => setShowFileList(!showFileList)}
                                className={cn(
                                    "lg:hidden p-1.5 rounded-lg transition-all border",
                                    showFileList ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-white/80 text-gray-600 border-gray-200/50 hover:bg-white"
                                )}
                            >
                                <FileIcon size={18} />
                            </button>

                            {/* Topic Navigator (compact, in header) */}
                            {topic && siblingTopics.length > 1 && (
                                <div className="hidden sm:flex items-center gap-0.5 bg-white/60 rounded-lg border border-gray-200/50 px-0.5">
                                    <button
                                        onClick={() => {
                                            if (currentIndex > 0) {
                                                const nextTopicId = siblingTopics[currentIndex - 1].id;
                                                router.push(`/topic?subjectId=${subjectId}&semester=${semester}&id=${nextTopicId}${isEditMode ? '&edit=true' : ''}`);
                                            }
                                        }}
                                        disabled={currentIndex <= 0}
                                        className="p-1 hover:text-blue-600 disabled:text-gray-300 transition-colors"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <span className="text-[10px] font-bold text-gray-400 min-w-[52px] text-center uppercase tracking-tight">
                                        {currentIndex + 1} / {totalTopics}
                                    </span>
                                    <button
                                        onClick={() => {
                                            if (currentIndex < siblingTopics.length - 1) {
                                                const nextTopicId = siblingTopics[currentIndex + 1].id;
                                                router.push(`/topic?subjectId=${subjectId}&semester=${semester}&id=${nextTopicId}${isEditMode ? '&edit=true' : ''}`);
                                            }
                                        }}
                                        disabled={currentIndex >= totalTopics - 1}
                                        className="p-1 hover:text-blue-600 disabled:text-gray-300 transition-colors"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            )}

                            {/* Edit Toggle ONLY for owners */}
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
                                        {votedFiles.has(topic.id) ? 'Nützlich' : '+3 XP'}
                                    </span>
                                </button>
                            )}
                        </div>
                    </div>
                </header>

                {/* ================================================================
                    MAIN CONTENT AREA
                ================================================================ */}
                <div className="flex-1 flex overflow-hidden relative">
                    {/* ============================================================
                        FILE SIDEBAR - Desktop: permanent, Mobile: overlay
                    ============================================================ */}
                    <aside className={cn(
                        "absolute md:relative z-30 h-full w-64 border-r border-gray-200/60 flex flex-col bg-white/90 backdrop-blur-xl transition-transform duration-300 md:translate-x-0",
                        showFileList ? "translate-x-0 shadow-2xl" : "-translate-x-full"
                    )}>
                        {/* Tab Switcher */}
                        <div className="p-2 border-b border-gray-100">
                            <div className="flex items-center justify-between mb-1.5 lg:hidden px-1">
                                <span className="text-xs font-bold text-gray-900">Materialien</span>
                                <button onClick={() => setShowFileList(false)} className="p-1 text-gray-400 hover:text-gray-600">
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="flex bg-gray-100/80 rounded-lg p-0.5">
                                <button
                                    onClick={() => setSidebarTab('files')}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-bold transition-all",
                                        sidebarTab === 'files'
                                            ? "bg-white text-gray-900 shadow-sm"
                                            : "text-gray-500 hover:text-gray-700"
                                    )}
                                >
                                    <FileIcon size={13} />
                                    Dateien
                                    <span className="bg-gray-200 text-gray-600 text-[10px] px-1.5 rounded-full font-black">
                                        {files.length}
                                    </span>
                                </button>
                                {isOwner && (
                                    <button
                                        onClick={() => setSidebarTab('notes')}
                                        className={cn(
                                            "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-bold transition-all",
                                            sidebarTab === 'notes'
                                                ? "bg-white text-gray-900 shadow-sm"
                                                : "text-gray-500 hover:text-gray-700"
                                        )}
                                    >
                                        <StickyNote size={13} />
                                        Notizen
                                        <span className="bg-gray-200 text-gray-600 text-[10px] px-1.5 rounded-full font-black">
                                            {notes.length}
                                        </span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* File/Note List */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                            {sidebarTab === 'files' ? (
                                <>
                                    {files.map((file, idx) => {
                                        const isSelected = selectedContent?.type === 'file' && selectedContent.index === idx;
                                        return (
                                            <button
                                                key={file.id}
                                                onClick={() => {
                                                    setSelectedFileIndex(idx);
                                                    setSelectedContent({ type: 'file', index: idx });
                                                    setShowFileList(false);
                                                }}
                                                className={cn(
                                                    "w-full group relative flex items-center gap-3 p-2.5 rounded-xl text-left transition-all",
                                                    isSelected
                                                        ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
                                                        : "text-gray-500 hover:bg-gray-50"
                                                )}
                                            >
                                                <div className={cn("p-2 rounded-lg shrink-0", isSelected ? "bg-white shadow-sm" : "bg-gray-100")}>
                                                    <FileIcon size={14} />
                                                </div>
                                                <span className="text-[13px] font-semibold truncate flex-1">{file.file_name}</span>

                                                {/* Calendar Link Button — only for own files */}
                                                {topic && topic.owner_id === user?.id && (
                                                    <div
                                                        onClick={(e) => openLinkModal(file, e)}
                                                        className={cn(
                                                            "p-1.5 rounded-md transition-all shrink-0",
                                                            file.material_date
                                                                ? "text-blue-500 bg-blue-50 hover:bg-blue-100"
                                                                : "text-gray-300 hover:text-blue-500 hover:bg-blue-50"
                                                        )}
                                                        title={file.material_date
                                                            ? `Verlinkt mit ${new Date(file.material_date + 'T00:00:00').toLocaleDateString('de-DE')}`
                                                            : 'Mit Kalendertag verlinken'}
                                                    >
                                                        <Link2 size={12} />
                                                    </div>
                                                )}

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
                                                            "p-1.5 rounded-md transition-all shrink-0",
                                                            votedFiles.has(file.id)
                                                                ? "text-green-500 bg-green-50"
                                                                : "text-gray-300 hover:text-green-500 hover:bg-green-50"
                                                        )}
                                                        title={votedFiles.has(file.id) ? 'Bereits als nützlich markiert' : 'Als nützlich markieren (+3 XP)'}
                                                    >
                                                        <ThumbsUp size={12} />
                                                    </div>
                                                )}

                                                {/* Delete - ALWAYS visible in edit mode */}
                                                {isEditMode && (
                                                    <div
                                                        onClick={(e) => handleDelete(file.id, file.storage_path, e)}
                                                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md shrink-0"
                                                    >
                                                        <Trash2 size={12} />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                    {files.length === 0 && (
                                        <div className="flex flex-col items-center justify-center p-6 text-center">
                                            <FileIcon size={24} className="text-gray-200 mb-2" />
                                            <p className="text-xs text-gray-400">Keine Dateien</p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    {notes.map(note => {
                                        const isSelected = selectedContent?.type === 'note' && selectedContent.noteId === note.id;
                                        return (
                                            <button
                                                key={note.id}
                                                onClick={() => {
                                                    setSelectedContent({ type: 'note', noteId: note.id });
                                                    setSelectedFileIndex(-1);
                                                    setShowFileList(false);
                                                }}
                                                className={cn(
                                                    "w-full group relative flex items-center gap-3 p-2.5 rounded-xl text-left transition-all",
                                                    isSelected
                                                        ? note.note_type === 'drawing' ? "bg-violet-50 text-violet-700 ring-1 ring-violet-100" : "bg-amber-50 text-amber-700 ring-1 ring-amber-100"
                                                        : "text-gray-500 hover:bg-gray-50"
                                                )}
                                            >
                                                <div className={cn("p-2 rounded-lg shrink-0", isSelected ? "bg-white shadow-sm" : note.note_type === 'drawing' ? "bg-violet-50" : "bg-amber-50")}>
                                                    {note.note_type === 'drawing' ? <PenTool size={14} /> : <StickyNote size={14} />}
                                                </div>
                                                <span className="text-[13px] font-semibold truncate flex-1">{note.title}</span>

                                                {/* Delete - ALWAYS visible in edit mode */}
                                                {isEditMode && (
                                                    <div
                                                        onClick={(e) => handleDeleteNote(note.id, e)}
                                                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md shrink-0"
                                                    >
                                                        <Trash2 size={12} />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                    {notes.length === 0 && (
                                        <div className="flex flex-col items-center justify-center p-6 text-center">
                                            <StickyNote size={24} className="text-gray-200 mb-2" />
                                            <p className="text-xs text-gray-400">Keine Notizen</p>
                                        </div>
                                    )}

                                    {/* Note creation buttons - ALWAYS visible for owners (no edit mode required) */}
                                    {isOwner && (
                                        <div className="space-y-1 pt-2 border-t border-gray-100 mt-2">
                                            <button
                                                onClick={handleCreateNote}
                                                className="w-full flex items-center gap-2 p-2.5 rounded-xl text-sm font-semibold text-amber-600 hover:bg-amber-50 transition-all"
                                            >
                                                <Plus size={14} />
                                                Textnotiz
                                            </button>
                                            <button
                                                onClick={handleCreateDrawing}
                                                className="w-full flex items-center gap-2 p-2.5 rounded-xl text-sm font-semibold text-violet-600 hover:bg-violet-50 transition-all"
                                            >
                                                <PenTool size={14} />
                                                Zeichnung
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </aside>

                    {/* Mobile Sidebar Overlay */}
                    {showFileList && (
                        <div className="lg:hidden absolute inset-0 bg-black/20 backdrop-blur-sm z-20" onClick={() => setShowFileList(false)} />
                    )}

                    {/* ============================================================
                        MAIN CONTENT (PDF / Notes / Empty State)
                    ============================================================ */}
                    <div className="flex-1 min-h-0 bg-[#e8e8ed] relative flex flex-col overflow-hidden">
                        <div className="flex-1 min-h-0 w-full overflow-hidden relative">
                            {/* Template Picker */}
                            {(selectedContent as any)?.type === 'template-picker' ? (
                                <NoteTemplatePicker onSelect={handleSelectTemplate} />
                            ) : selectedContent?.type === 'note' ? (
                                <NoteEditor
                                    noteId={selectedContent.noteId}
                                    editable={isOwner}
                                    onNoteUpdate={(updated) => updateNoteInList(updated)}
                                />
                            ) : files.length === 0 && notes.length === 0 ? (
                                /* Empty State - Upload/create without edit mode */
                                <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                                        <FileIcon className="w-10 h-10 text-blue-500" />
                                    </div>
                                    <h2 className="text-xl font-bold text-gray-900 mb-2">Noch keine Dokumente</h2>
                                    <p className="text-gray-500 mb-8 max-w-sm">
                                        Lade eine PDF hoch oder erstelle eine Notiz.
                                    </p>

                                    {isOwner && (
                                        <div className="flex flex-col gap-3 w-full max-w-xs">
                                            {isMobile() && (
                                                <label className="flex items-center justify-center gap-3 w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl font-bold text-base hover:scale-105 transition-all shadow-xl shadow-purple-500/30 cursor-pointer">
                                                    <ScanLine size={24} />
                                                    Dokument fotografieren
                                                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleUpload} />
                                                </label>
                                            )}

                                            <label className="cursor-pointer w-full flex items-center justify-center gap-2 bg-white text-gray-900 border border-gray-200 rounded-xl px-5 py-4 font-bold hover:bg-gray-50 transition-all active:scale-[0.98]">
                                                <FolderOpen size={20} className="text-blue-500" />
                                                PDF Hochladen
                                                <input type="file" accept="application/pdf,.iwb" className="hidden" onChange={handleUpload} />
                                            </label>

                                            <label className="cursor-pointer w-full flex items-center justify-center gap-2 bg-white text-gray-900 border border-gray-200 rounded-xl px-5 py-4 font-bold hover:bg-gray-50 transition-all active:scale-[0.98]">
                                                <Image size={20} className="text-green-500" />
                                                Aus Galerie wählen
                                                <input type="file" accept="image/png,image/jpeg,image/jpg" className="hidden" onChange={handleUpload} />
                                            </label>

                                            <button
                                                onClick={handleCreateNote}
                                                className="w-full flex items-center justify-center gap-2 bg-white text-gray-900 border border-gray-200 rounded-xl px-5 py-4 font-bold hover:bg-gray-50 transition-all active:scale-[0.98]"
                                            >
                                                <FileText size={20} className="text-amber-500" />
                                                Textnotiz erstellen
                                            </button>

                                            <button
                                                onClick={handleCreateDrawing}
                                                className="w-full flex items-center justify-center gap-2 bg-white text-gray-900 border border-gray-200 rounded-xl px-5 py-4 font-bold hover:bg-gray-50 transition-all active:scale-[0.98]"
                                            >
                                                <PenTool size={20} className="text-violet-500" />
                                                Zeichnung erstellen
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : selectedContent?.type === 'file' ? (
                                <>
                                    {currentFile && /\.iwb$/i.test(currentFile.file_name) && pdfUrl ? (
                                        <IWBViewer url={pdfUrl} fileName={currentFile.file_name} />
                                    ) : (
                                        <PDFViewer
                                            url={pdfUrl}
                                            topicId={idParam || undefined}
                                        />
                                    )}

                                    {/* Floating "Nützlich" FAB for friends' materials */}
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
                                                "fixed right-4 md:bottom-16 md:right-6 z-[60] flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-full shadow-2xl transition-all active:scale-95 group",
                                                "bottom-[calc(8rem+env(safe-area-inset-bottom,0px))]",
                                                votedFiles.has(currentFile.id)
                                                    ? "bg-green-500 text-white shadow-green-500/30 ring-4 ring-green-50"
                                                    : "bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-1"
                                            )}
                                            title={votedFiles.has(currentFile.id) ? 'Bereits bewertet' : 'Hilfreich (+3 XP)'}
                                        >
                                            <ThumbsUp size={20} className={cn("md:!w-6 md:!h-6 transition-transform", votedFiles.has(currentFile.id) ? "fill-white" : "group-hover:rotate-12")} strokeWidth={votedFiles.has(currentFile.id) ? 2 : 2.5} />
                                            {!votedFiles.has(currentFile.id) && (
                                                <span className="absolute -top-2 -right-2 bg-pink-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm border-2 border-white">
                                                    +3 XP
                                                </span>
                                            )}
                                        </button>
                                    )}
                                </>
                            ) : (
                                <div className="h-full flex items-center justify-center">
                                    <p className="text-gray-400 text-sm">Wähle eine Datei oder Notiz aus der Seitenleiste</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* ================================================================
                CALENDAR LINK MODAL
            ================================================================ */}
            <AnimatePresence>
                {linkingFile && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[120] flex items-center justify-center p-4"
                        onClick={closeLinkModal}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Link2 size={18} className="text-blue-500 flex-shrink-0" />
                                    <h3 className="font-bold text-gray-900 truncate">Mit Kalender verlinken</h3>
                                </div>
                                <button onClick={closeLinkModal} className="p-1.5 hover:bg-gray-100 rounded-lg flex-shrink-0">
                                    <X size={18} className="text-gray-500" />
                                </button>
                            </div>
                            <div className="p-6">
                                <p className="text-xs text-gray-500 mb-1">Datei</p>
                                <p className="text-sm font-medium text-gray-900 truncate mb-4">{linkingFile.file_name}</p>

                                <label className="block text-xs font-medium text-gray-500 mb-1.5">Kalendertag</label>
                                <input
                                    type="date"
                                    value={linkDate}
                                    onChange={(e) => setLinkDate(e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />

                                {linkingFile.material_date && (
                                    <p className="mt-3 text-xs text-blue-600 flex items-center gap-1.5">
                                        <CalendarIcon size={12} />
                                        Aktuell verlinkt mit {new Date(linkingFile.material_date + 'T00:00:00').toLocaleDateString('de-DE')}
                                    </p>
                                )}
                            </div>
                            <div className="px-6 py-4 border-t border-gray-100 flex justify-between gap-2">
                                <button
                                    onClick={() => saveFileDate(null)}
                                    disabled={linkSaving || !linkingFile.material_date}
                                    className="px-4 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-30"
                                >
                                    Verknüpfung lösen
                                </button>
                                <div className="flex gap-2">
                                    <button
                                        onClick={closeLinkModal}
                                        className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100"
                                    >
                                        Abbrechen
                                    </button>
                                    <button
                                        onClick={() => saveFileDate(linkDate)}
                                        disabled={linkSaving || !linkDate}
                                        className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        {linkSaving ? 'Speichert...' : 'Speichern'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ================================================================
                FLOATING ACTION BUTTON (FAB) - Always visible for owners
            ================================================================ */}
            {isOwner && selectedContent?.type !== 'note' && (selectedContent as any)?.type !== 'template-picker' && (
                <div className="fixed right-4 md:bottom-16 md:right-6 z-[60] bottom-[calc(5rem+env(safe-area-inset-bottom,0px))]">
                    <AnimatePresence>
                        {showFabMenu && (
                            <>
                                <div className="fixed inset-0 z-[55]" onClick={() => setShowFabMenu(false)} />
                                <motion.div
                                    initial={{ opacity: 0, y: 16, scale: 0.9 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 16, scale: 0.9 }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                    className="absolute bottom-16 right-0 z-[60] w-52 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
                                >
                                    <div className="p-1.5 space-y-0.5">
                                        {isMobile() && (
                                            <label className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl hover:bg-gray-50 transition-colors text-sm font-semibold text-gray-700 cursor-pointer">
                                                <div className="p-1.5 bg-purple-100 text-purple-600 rounded-lg">
                                                    <ScanLine size={16} />
                                                </div>
                                                Fotografieren
                                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleUpload} />
                                            </label>
                                        )}
                                        <label className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl hover:bg-gray-50 transition-colors text-sm font-semibold text-gray-700 cursor-pointer">
                                            <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                                                <FolderOpen size={16} />
                                            </div>
                                            PDF hochladen
                                            <input type="file" accept="application/pdf,.iwb" className="hidden" onChange={handleUpload} />
                                        </label>
                                        <label className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl hover:bg-gray-50 transition-colors text-sm font-semibold text-gray-700 cursor-pointer">
                                            <div className="p-1.5 bg-green-100 text-green-600 rounded-lg">
                                                <Image size={16} />
                                            </div>
                                            Foto hinzufügen
                                            <input type="file" accept="image/png,image/jpeg,image/jpg" className="hidden" onChange={handleUpload} />
                                        </label>
                                        <button
                                            onClick={handleCreateNote}
                                            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl hover:bg-gray-50 transition-colors text-sm font-semibold text-gray-700"
                                        >
                                            <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg">
                                                <FileText size={16} />
                                            </div>
                                            Textnotiz
                                        </button>
                                        <button
                                            onClick={handleCreateDrawing}
                                            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl hover:bg-gray-50 transition-colors text-sm font-semibold text-gray-700"
                                        >
                                            <div className="p-1.5 bg-violet-100 text-violet-600 rounded-lg">
                                                <PenTool size={16} />
                                            </div>
                                            Zeichnung
                                        </button>
                                    </div>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>

                    <motion.button
                        onClick={() => setShowFabMenu(!showFabMenu)}
                        whileTap={{ scale: 0.9 }}
                        className={cn(
                            "w-12 h-12 md:w-14 md:h-14 rounded-full shadow-2xl flex items-center justify-center transition-all",
                            showFabMenu
                                ? "bg-gray-900 text-white shadow-gray-900/30"
                                : "bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-blue-500/40 hover:shadow-blue-500/60 hover:-translate-y-0.5"
                        )}
                    >
                        <Plus size={20} strokeWidth={2.5} className={cn("md:!w-6 md:!h-6 transition-transform", showFabMenu && "rotate-45")} />
                    </motion.button>
                </div>
            )}

            {/* Navigation Sidebar - Overlay only on subpages */}
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} mobileOnly />
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
