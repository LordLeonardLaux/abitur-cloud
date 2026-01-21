'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SUBJECTS } from '@/lib/constants';
import { Topic, TopicFile } from '@/lib/types';
import { ChevronLeft, ChevronRight, Plus, Upload, Trash2, File as FileIcon, Menu, X } from 'lucide-react';
import { EditToggle } from '@/components/ui/EditToggle';
import { cn } from '@/lib/utils';
import { Sidebar } from '@/components/dashboard/Sidebar';
import PDFViewer from '@/components/ui/PDFViewer';

function TopicMain() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { user } = useAuth();

    const idParam = searchParams.get('id'); // Topic ID
    const subjectId = searchParams.get('subjectId');
    const semester = searchParams.get('semester');
    const isEditMode = searchParams.get('edit') === 'true';

    const [topic, setTopic] = useState<Topic | null>(null);
    const [files, setFiles] = useState<TopicFile[]>([]);
    const [selectedFileIndex, setSelectedFileIndex] = useState<number>(-1);
    const [loading, setLoading] = useState(true);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [customTitle, setCustomTitle] = useState('');
    const [siblingTopics, setSiblingTopics] = useState<Topic[]>([]);
    const [totalTopics, setTotalTopics] = useState(0);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [showFileList, setShowFileList] = useState(false);

    const subject = SUBJECTS.find((s) => s.id === subjectId);

    useEffect(() => {
        if (!user || !idParam) return;

        const fetchData = async () => {
            setLoading(true);

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
            setLoading(false);
        };
        fetchData();
    }, [idParam, user, subjectId, semester]);

    useEffect(() => {
        if (selectedFileIndex !== -1 && files[selectedFileIndex]) {
            const { data } = supabase.storage.from('topic-files').getPublicUrl(files[selectedFileIndex].storage_path);
            setPdfUrl(data.publicUrl);
        } else {
            setPdfUrl(null);
        }
    }, [selectedFileIndex, files]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0] || !topic) return;
        const file = e.target.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `${user?.id}/${subjectId}/${semester}/${idParam}/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('topic-files').upload(filePath, file);
        if (uploadError) { alert('Upload error'); return; }

        const { data: newFile } = await supabase.from('topic_files').insert({
            topic_id: idParam,
            file_name: file.name,
            storage_path: filePath
        }).select().single();

        if (newFile) {
            setFiles([newFile, ...files]);
            if (selectedFileIndex === -1) setSelectedFileIndex(0);
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

    const navigateTopic = (direction: 'next' | 'prev') => {
        if (!topic || siblingTopics.length === 0) return;
        const currentIndex = siblingTopics.findIndex(t => t.id === topic.id);
        if (currentIndex === -1) return;

        let nextTopicId;
        if (direction === 'next' && currentIndex < siblingTopics.length - 1) {
            nextTopicId = siblingTopics[currentIndex + 1].id;
        } else if (direction === 'prev' && currentIndex > 0) {
            nextTopicId = siblingTopics[currentIndex - 1].id;
        }

        if (nextTopicId) {
            router.push(`/topic?subjectId=${subjectId}&semester=${semester}&id=${nextTopicId}${isEditMode ? '&edit=true' : ''}`);
        }
    };

    if (loading) return <div className="p-10 text-center flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
    if (!topic || !subject) return <div className="p-10 text-center">Not found</div>;

    const currentIndex = siblingTopics.findIndex(t => t.id === topic.id);

    return (
        <main className="h-screen flex flex-col bg-white overflow-hidden">
            {/* Standardized Header */}
            <div className="bg-white border-b border-gray-100 flex-shrink-0">
                <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href={`/subject?id=${subjectId}`} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
                            <ChevronLeft className="w-6 h-6 text-gray-600" />
                        </Link>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                {isEditMode ? (
                                    isEditingTitle ? (
                                        <input
                                            autoFocus
                                            className="text-base md:text-lg font-bold outline-none border-b-2 border-blue-500 bg-transparent"
                                            value={customTitle}
                                            onChange={e => setCustomTitle(e.target.value)}
                                            onBlur={() => handleRename(customTitle)}
                                            onKeyDown={e => e.key === 'Enter' && handleRename(customTitle)}
                                        />
                                    ) : (
                                        <h1 onClick={() => setIsEditingTitle(true)} className="text-base md:text-lg font-bold cursor-pointer hover:text-blue-600 flex items-center gap-2 group truncate">
                                            {topic.title} <Plus size={14} className="opacity-0 group-hover:opacity-100" />
                                        </h1>
                                    )
                                ) : (
                                    <h1 className="text-base md:text-lg font-bold truncate max-w-[150px] md:max-w-none">{topic.title}</h1>
                                )}
                            </div>
                            <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-widest font-bold">
                                {subject.name} • {semester}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Mobile File List Toggle */}
                        <button
                            onClick={() => setShowFileList(!showFileList)}
                            className={cn(
                                "md:hidden p-2 rounded-xl transition-all",
                                showFileList ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-gray-50 text-gray-600 border border-gray-100"
                            )}
                        >
                            <FileIcon size={20} />
                        </button>

                        {isEditMode && (
                            <label className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 cursor-pointer text-xs md:text-sm font-bold shadow-sm active:scale-95 transition-all">
                                <Plus size={16} /> <span className="hidden sm:inline">Upload</span>
                                <input type="file" accept="application/pdf" className="hidden" onChange={handleUpload} />
                            </label>
                        )}
                        <EditToggle />

                        {/* Mobile Burger Menu Inline */}
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="md:hidden p-2 bg-white border border-gray-100 shadow-sm rounded-xl text-gray-900 active:scale-95"
                        >
                            <Menu size={24} />
                        </button>
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
                <div className="flex-1 bg-gray-50 relative flex flex-col overflow-hidden">
                    {/* Navigation Bar */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4 px-4 py-2 bg-white/95 backdrop-blur-md rounded-full shadow-lg border border-gray-100">
                        <button
                            onClick={() => navigateTopic('prev')}
                            disabled={currentIndex <= 0}
                            className="p-1 hover:text-blue-600 disabled:text-gray-200 transition-colors"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <span className="text-[10px] font-black text-gray-500 min-w-[70px] text-center uppercase tracking-tighter">
                            Thema {currentIndex + 1} / {totalTopics}
                        </span>
                        <button
                            onClick={() => navigateTopic('next')}
                            disabled={currentIndex >= totalTopics - 1}
                            className="p-1 hover:text-blue-600 disabled:text-gray-200 transition-colors"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    <div className="flex-1 w-full h-full overflow-hidden relative">
                        <PDFViewer url={pdfUrl} />
                    </div>
                </div>
            </div>

            {/* Navigation Sidebar Component */}
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        </main>
    );
}

export default function TopicPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
            <TopicMain />
        </Suspense>
    );
}
