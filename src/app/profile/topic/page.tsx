'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { SUBJECTS } from '@/lib/constants';
import { Topic, TopicFile, Profile } from '@/lib/types';
import { ChevronLeft, ChevronRight, File as FileIcon, X, Menu, ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sidebar } from '@/components/dashboard/Sidebar';
import PDFViewer from '@/components/ui/PDFViewer';
import { useAuth } from '@/contexts/AuthContext';
import { voteUseful, getUserVotes } from '@/services/xpService';

function FriendTopicContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

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
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [showFileList, setShowFileList] = useState(false);
    const { user, profile: authProfile, setProfile: setAuthProfile } = useAuth();
    const [votedFiles, setVotedFiles] = useState<Set<string>>(new Set());
    const [votingFileId, setVotingFileId] = useState<string | null>(null);

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

        // Load existing votes
        if (user?.id) {
            getUserVotes(user.id).then(votes => {
                setVotedFiles(new Set(votes));
            }).catch(err => console.error('Load votes error:', err));
        }
    }, [topicId, friendId, subjectId, semester, user]);

    useEffect(() => {
        const loadPdf = async () => {
            if (selectedFileIndex !== -1 && files[selectedFileIndex]) {
                const storagePath = files[selectedFileIndex].storage_path;

                // Use signed URL for better performance and reliability
                const { data, error } = await supabase.storage.from('topic-files').createSignedUrl(storagePath, 3600);

                if (error) {
                    console.error("Error creating friend signed PDF URL:", error);
                    setPdfUrl(null);
                    return;
                }

                if (data?.signedUrl) {
                    setPdfUrl(data.signedUrl);
                }
            } else {
                setPdfUrl(null);
            }
        };

        loadPdf();
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

    if (!subject || !topic) return <div className="p-10 text-center flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

    const currentIndex = siblingTopics.findIndex(t => t.id === topic.id);

    return (
        <main className="h-screen flex flex-col bg-white overflow-hidden">
            {/* Standardized Header */}
            <div className="bg-white border-b border-gray-100 flex-shrink-0">
                <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href={`/profile/subject?id=${subjectId}&userId=${friendId}`} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
                            <ChevronLeft className="w-6 h-6 text-gray-600" />
                        </Link>
                        <div className="min-w-0">
                            <h1 className="text-base md:text-lg font-bold truncate max-w-[150px] md:max-w-none text-gray-900">{topic.title}</h1>
                            <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-widest font-bold truncate">
                                {subject.name} • {semester} • {profile?.full_name}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Mobile File List Toggle */}
                        <button
                            onClick={() => setShowFileList(!showFileList)}
                            className={cn(
                                "md:hidden p-2 rounded-xl transition-all",
                                showFileList ? "bg-blue-600 text-white shadow-lg" : "bg-gray-50 text-gray-600 border border-gray-100"
                            )}
                        >
                            <FileIcon size={20} />
                        </button>

                        <div className="hidden sm:block">
                            {/* Optional info or placeholders */}
                        </div>

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
                                    "w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all",
                                    selectedFileIndex === idx
                                        ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
                                        : "text-gray-500 hover:bg-gray-50"
                                )}
                            >
                                <div className={cn("p-2 rounded-lg", selectedFileIndex === idx ? "bg-white shadow-sm" : "bg-gray-100")}>
                                    <FileIcon size={16} />
                                </div>
                                <span className="text-sm font-semibold truncate flex-1">{file.file_name}</span>
                            </button>
                        ))}
                        {files.length === 0 && (
                            <div className="flex flex-col items-center justify-center p-8 text-center">
                                <FileIcon size={32} className="text-gray-200 mb-2" />
                                <p className="text-xs text-gray-400">Keine Dateien.</p>
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
                        <PDFViewer url={pdfUrl} topicId={topicId || undefined} />

                        {/* Floating Action Button (FAB) for 'Nützlich' */}
                        {files[selectedFileIndex] && user?.id !== friendId && authProfile?.rank_visible !== false && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const currentFile = files[selectedFileIndex];
                                    if (!user || votedFiles.has(currentFile.id) || votingFileId === currentFile.id) return;
                                    voteUseful(user.id, currentFile.id, friendId as string, 'topic_file').then(result => {
                                        if (result.success || result.alreadyVoted) {
                                            setVotedFiles(prev => new Set([...prev, currentFile.id]));
                                        }
                                    }).finally(() => setVotingFileId(null));
                                }}
                                className={cn(
                                    "absolute bottom-24 right-6 md:bottom-10 md:right-10 z-[60] flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full shadow-2xl transition-all active:scale-95 group",
                                    votedFiles.has(files[selectedFileIndex]?.id)
                                        ? "bg-green-500 text-white shadow-green-500/30 ring-4 ring-green-50"
                                        : "bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-1"
                                )}
                                title={votedFiles.has(files[selectedFileIndex]?.id) ? 'Bereits bewertet' : 'Hilfreich (+3 XP)'}
                            >
                                <ThumbsUp size={28} className={cn("transition-transform", votedFiles.has(files[selectedFileIndex]?.id) ? "fill-white" : "group-hover:rotate-12")} strokeWidth={votedFiles.has(files[selectedFileIndex]?.id) ? 2 : 2.5} />

                                {/* XP Badge */}
                                {!votedFiles.has(files[selectedFileIndex]?.id) && (
                                    <span className="absolute -top-2 -right-2 bg-pink-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm border-2 border-white">
                                        +3 XP
                                    </span>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Navigation Sidebar Component */}
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        </main >
    );
}

export default function Page() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
            <FriendTopicContent />
        </Suspense>
    );
}
