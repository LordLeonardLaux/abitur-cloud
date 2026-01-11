'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { SUBJECTS } from '@/lib/constants';
import { Topic, TopicFile, Profile } from '@/lib/types';
import { ChevronLeft, ChevronRight, File as FileIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

function FriendTopicContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    // const supabase = createClient(); // uses singleton

    const subjectId = searchParams.get('subjectId');
    const semester = searchParams.get('semester');
    const topicId = searchParams.get('id');
    const friendId = searchParams.get('userId');

    const [topic, setTopic] = useState<Topic | null>(null);
    const [files, setFiles] = useState<TopicFile[]>([]);
    const [selectedFileIndex, setSelectedFileIndex] = useState<number>(-1);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [siblingTopics, setSiblingTopics] = useState<Topic[]>([]);
    const [totalTopics, setTotalTopics] = useState(0);

    const subject = SUBJECTS.find(s => s.id === subjectId);

    useEffect(() => {
        if (!topicId || !friendId) return;
        supabase.from('profiles').select('*').eq('id', friendId).single().then(({ data }) => setProfile(data));
        supabase.from('topics').select('*').eq('id', topicId).single().then(async ({ data: topicData }) => {
            setTopic(topicData);
            if (topicData) {
                const { data: siblings } = await supabase.from('topics').select('*').eq('owner_id', friendId).eq('subject_id', subjectId).eq('semester', semester).order('index');
                setSiblingTopics(siblings || []);
                setTotalTopics(siblings?.length || 0);
            }
        });
        supabase.from('topic_files').select('*').eq('topic_id', topicId).order('created_at', { ascending: false }).then(({ data }) => {
            setFiles(data || []);
            if (data && data.length > 0) setSelectedFileIndex(0);
        });
    }, [topicId, friendId, subjectId, semester]);

    useEffect(() => {
        if (selectedFileIndex !== -1 && files[selectedFileIndex]) {
            const { data } = supabase.storage.from('topic-files').getPublicUrl(files[selectedFileIndex].storage_path);
            setPdfUrl(data.publicUrl);
        } else setPdfUrl(null);
    }, [selectedFileIndex, files]);

    const navigateTopic = (direction: 'next' | 'prev') => {
        if (!topic || siblingTopics.length === 0) return;
        const index = siblingTopics.findIndex(t => t.id === topic.id);
        if (index === -1) return;
        let nextId;
        if (direction === 'next' && index < siblingTopics.length - 1) nextId = siblingTopics[index + 1].id;
        else if (direction === 'prev' && index > 0) nextId = siblingTopics[index - 1].id;
        if (nextId) router.push(`/profile/topic?subjectId=${subjectId}&semester=${semester}&id=${nextId}&userId=${friendId}`);
    };

    if (!subject || !topic) return <div>Loading...</div>;

    return (
        <main className="h-screen flex flex-col bg-white overflow-hidden">
            <div className="bg-white border-b border-gray-100 flex-shrink-0 pt-10">
                <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4 pl-16">
                        <Link href={`/profile/subject?id=${subjectId}&userId=${friendId}`} className="p-2 -ml-2 rounded-full hover:bg-gray-100 flex-shrink-0"><ChevronLeft className="w-5 h-5 text-gray-600" /></Link>
                        <div className="min-w-0 flex-1"><h1 className="text-lg font-bold text-gray-900 leading-tight truncate">{topic.title}</h1><p className="text-xs text-gray-500 uppercase tracking-wider truncate">{subject.name} • {semester} • von {profile?.full_name}</p></div>
                    </div>
                </div>
            </div>
            <div className="flex-1 flex overflow-hidden">
                <aside className="w-64 border-r border-gray-100 flex flex-col bg-gray-50/50">
                    <div className="p-4 border-b border-gray-100"><h3 className="text-xs font-bold text-gray-400">Dateien (Nur Lesen)</h3></div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {files.map((file, idx) => (
                            <button key={file.id} onClick={() => setSelectedFileIndex(idx)} className={cn("w-full flex items-center gap-3 p-3 rounded-xl text-left", selectedFileIndex === idx ? "bg-white shadow-sm ring-1 ring-blue-500/20 text-blue-600" : "text-gray-500 hover:bg-white")}>
                                <div className={cn("p-2 rounded-lg", selectedFileIndex === idx ? "bg-blue-50" : "bg-gray-100")}><FileIcon size={16} /></div><span className="text-sm font-medium truncate flex-1">{file.file_name}</span>
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
                    {pdfUrl ? <iframe src={pdfUrl} className="w-full h-full border-none" /> : <div className="flex-1 flex items-center justify-center text-gray-400">Keine Datei ausgewählt</div>}
                </div>
            </div>
        </main>
    )
}

export default function Page() { return <Suspense fallback={<div>Loading...</div>}><FriendTopicContent /></Suspense> }
