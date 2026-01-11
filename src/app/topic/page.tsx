'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SUBJECTS } from '@/lib/constants';
import { Topic, TopicFile } from '@/lib/types';
import { ChevronLeft, ChevronRight, Plus, Upload, Trash2, File as FileIcon } from 'lucide-react';
import { EditToggle } from '@/components/ui/EditToggle';
import { cn } from '@/lib/utils';

function TopicMain() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { user } = useAuth();
    // const supabase = createClient(); // uses singleton

    const idParam = searchParams.get('id'); // Topic ID
    const subjectId = searchParams.get('subjectId');
    const semester = searchParams.get('semester');
    const isEditMode = searchParams.get('edit') === 'true';

    // ... (rest of the component state and logic is similar, just using params)
    const [topic, setTopic] = useState<Topic | null>(null);
    const [files, setFiles] = useState<TopicFile[]>([]);
    const [selectedFileIndex, setSelectedFileIndex] = useState<number>(-1);
    const [loading, setLoading] = useState(true);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [customTitle, setCustomTitle] = useState('');
    const [siblingTopics, setSiblingTopics] = useState<Topic[]>([]);
    const [totalTopics, setTotalTopics] = useState(0);

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
    }, [idParam, user, subjectId, semester, supabase]);

    useEffect(() => {
        if (selectedFileIndex !== -1 && files[selectedFileIndex]) {
            const { data } = supabase.storage.from('topic-files').getPublicUrl(files[selectedFileIndex].storage_path);
            setPdfUrl(data.publicUrl);
        } else {
            setPdfUrl(null);
        }
    }, [selectedFileIndex, files, supabase]);

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


    if (loading) return <div>Loading...</div>;
    if (!topic || !subject) return <div>Not found</div>;

    return (
        <main className="h-screen flex flex-col bg-white overflow-hidden">
            {/* Header ... reused layout */}
            <div className="bg-white border-b border-gray-100 flex-shrink-0 pt-10">
                <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4 pl-16">
                        <Link href={`/subject?id=${subjectId}`} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
                            <ChevronLeft className="w-5 h-5 text-gray-600" />
                        </Link>
                        <div>
                            {isEditMode ? (
                                isEditingTitle ? (
                                    <input autoFocus className="text-lg font-bold" value={customTitle} onChange={e => setCustomTitle(e.target.value)} onBlur={() => handleRename(customTitle)} onKeyDown={e => e.key === 'Enter' && handleRename(customTitle)} />
                                ) : (
                                    <h1 onClick={() => setIsEditingTitle(true)} className="text-lg font-bold cursor-pointer hover:text-blue-600 flex items-center gap-2 group">{topic.title} <Plus size={14} className="opacity-0 group-hover:opacity-100" /></h1>
                                )
                            ) : (
                                <h1 className="text-lg font-bold">{topic.title}</h1>
                            )}
                            <p className="text-xs text-gray-500 uppercase tracking-wider">{subject.name} • {semester}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {isEditMode && (
                            <label className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 cursor-pointer text-sm font-medium">
                                <Plus size={16} /> <span>Upload</span>
                                <input type="file" accept="application/pdf" className="hidden" onChange={handleUpload} />
                            </label>
                        )}
                        <EditToggle />
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                <aside className="w-64 border-r border-gray-100 flex flex-col bg-gray-50/50">
                    <div className="p-4 border-b border-gray-100"><h3 className="text-xs font-bold text-gray-400">Dateien</h3></div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {files.map((file, idx) => (
                            <button key={file.id} onClick={() => setSelectedFileIndex(idx)} className={cn("w-full group relative flex items-center gap-3 p-3 rounded-xl text-left", selectedFileIndex === idx ? "bg-white shadow-sm ring-1 ring-blue-500/20 text-blue-600" : "text-gray-500 hover:bg-white")}>
                                <div className={cn("p-2 rounded-lg", selectedFileIndex === idx ? "bg-blue-50" : "bg-gray-100")}><FileIcon size={16} /></div>
                                <span className="text-sm font-medium truncate flex-1">{file.file_name}</span>
                                {isEditMode && <div onClick={(e) => handleDelete(file.id, file.storage_path, e)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md opacity-0 group-hover:opacity-100"><Trash2 size={12} /></div>}
                            </button>
                        ))}
                    </div>
                </aside>

                <div className="flex-1 bg-gray-100 relative flex flex-col">
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 px-4 py-2 bg-white/90 backdrop-blur rounded-full shadow-lg border border-white/20">
                        <button onClick={() => navigateTopic('prev')} disabled={siblingTopics.findIndex(t => t.id === topic.id) <= 0} className="p-1.5 hover:text-blue-600 disabled:text-gray-300"><ChevronLeft size={20} /></button>
                        <span className="text-xs font-bold text-gray-500 min-w-[80px] text-center">Thema {siblingTopics.findIndex(t => t.id === topic.id) + 1} / {totalTopics}</span>
                        <button onClick={() => navigateTopic('next')} disabled={siblingTopics.findIndex(t => t.id === topic.id) >= totalTopics - 1} className="p-1.5 hover:text-blue-600 disabled:text-gray-300"><ChevronRight size={20} /></button>
                    </div>
                    {pdfUrl ? <iframe src={pdfUrl} className="w-full h-full border-none" /> : <div className="flex-1 flex items-center justify-center text-gray-400">Kein Dokument ausgewählt</div>}
                </div>
            </div>
        </main>
    )
}

export default function TopicPage() {
    return <Suspense fallback={<div>Loading...</div>}><TopicMain /></Suspense>
}
