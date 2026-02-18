"use client";

import { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
    ChevronLeft,
    ChevronRight,
    Loader2,
    ZoomIn,
    ZoomOut,
    Sparkles,
    ExternalLink,
    AlertCircle
} from 'lucide-react';
import { showAIFeatures } from '@/lib/platform';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { cn } from '@/lib/utils';
import { FlashcardGenButton } from '@/components/ai/FlashcardGenButton';
import AIChatWindow from '@/components/ai/AIChatWindow';
import FlashcardViewer from '@/components/ai/FlashcardViewer';
import { Flashcard } from '@/lib/flashcardPdfGenerator';

// Configure PDF.js worker - use explicit https CDN for Electron compatibility
if (typeof window !== 'undefined') {
    const pdfjsVersion = pdfjs.version;
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;
}

// Robust initial width calculation
function getInitialWidth(): number {
    if (typeof window === 'undefined') return 800;
    return Math.max(window.innerWidth - 80, 400);
}

interface PDFViewerProps {
    url: string | null;
    topicId?: string;
}

export default function PDFViewer({ url, topicId }: PDFViewerProps) {
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [scale, setScale] = useState<number>(1.0);
    const [containerWidth, setContainerWidth] = useState<number>(getInitialWidth());
    const containerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [extractedText, setExtractedText] = useState<string>('');
    const [isAIChatOpen, setIsAIChatOpen] = useState(false);
    const [aiInitialMessage, setAiInitialMessage] = useState<string | undefined>(undefined);
    const [isContinuous, setIsContinuous] = useState(false);
    const [pageImages, setPageImages] = useState<Array<{ base64: string, mimeType: string }>>([]);
    const pdfDocRef = useRef<any>(null);
    const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
    const [isFlashcardViewerOpen, setIsFlashcardViewerOpen] = useState(false);

    // Track if we've already done the initial load for this URL to prevent loops
    const hasLoadedRef = useRef<string | null>(null);
    // Extra state to trigger a SINGLE force-rerender after loading
    const [forceRenderPhase, setForceRenderPhase] = useState<'idle' | 'loading' | 'ready'>('idle');

    // Reset on URL change
    useEffect(() => {
        if (url !== hasLoadedRef.current) {
            hasLoadedRef.current = null;
            setForceRenderPhase('loading');
            setLoading(true);
            setNumPages(null);
            setError(null);
        }
    }, [url]);

    // Sync width detection
    useLayoutEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                const width = containerRef.current.clientWidth;
                if (width > 0) {
                    setContainerWidth(width);
                }
            }
        };

        updateWidth();
        window.addEventListener('resize', updateWidth);

        // Force a width update after a short delay for Electron/Next.js layout shifts
        const timer = setTimeout(updateWidth, 150);

        return () => {
            window.removeEventListener('resize', updateWidth);
            clearTimeout(timer);
        };
    }, [url]);

    // ResizeObserver for ongoing updates
    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            if (entries[0] && entries[0].contentRect.width > 0) {
                setContainerWidth(entries[0].contentRect.width);
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const extractText = useCallback(async (pdf: any) => {
        try {
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map((item: any) => item.str).join(' ');
                fullText += pageText + '\n';
            }
            setExtractedText(fullText);
        } catch (err) {
            console.error("[PDFViewer] Text extraction failed:", err);
        }
    }, []);

    // NEW: Render PDF pages to images for AI vision analysis
    const renderPagesToImages = useCallback(async (pdf: any, maxPages: number = 3) => {
        try {
            console.log("[PDFViewer] Rendering pages to images for AI vision...");
            const images: Array<{ base64: string, mimeType: string }> = [];
            const pagesToRender = Math.min(pdf.numPages, maxPages);

            for (let i = 1; i <= pagesToRender; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 1.5 }); // Higher quality

                // Create canvas for rendering
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                if (!context) continue;

                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({
                    canvasContext: context,
                    viewport: viewport,
                }).promise;

                // Convert to base64
                const base64 = canvas.toDataURL('image/png');
                images.push({
                    base64: base64,
                    mimeType: 'image/png'
                });

                console.log(`[PDFViewer] Rendered page ${i} to image`);
            }

            setPageImages(images);
            console.log(`[PDFViewer] Total ${images.length} pages rendered for AI vision`);
        } catch (err) {
            console.error("[PDFViewer] Page image rendering failed:", err);
        }
    }, []);

    const onDocumentLoadSuccess = useCallback(async (pdf: any) => {
        // Only process once per URL to prevent infinite loops
        if (hasLoadedRef.current === url) {
            console.log("[PDFViewer] Already loaded, skipping...");
            return;
        }

        console.log("[PDFViewer] Success:", pdf.numPages, "pages");
        hasLoadedRef.current = url;

        setNumPages(pdf.numPages);
        setPageNumber(1);
        setError(null);

        try {
            const page = await pdf.getPage(1);
            const { width, height } = page.getViewport({ scale: 1 });
            if (width > height) setIsContinuous(true);
        } catch (err) {
            console.error("[PDFViewer] Orientation check failed:", err);
        }

        extractText(pdf);

        // Render pages to images for AI vision (handwritten/graphical content)
        renderPagesToImages(pdf);

        // Store PDF reference for later use
        pdfDocRef.current = pdf;

        // Trigger a SINGLE re-render to ensure canvas paints
        setTimeout(() => {
            setForceRenderPhase('ready');
            setLoading(false);
            console.log("[PDFViewer] Force render phase set to ready");
        }, 200);
    }, [extractText, url]);

    const onDocumentLoadError = useCallback((err: Error) => {
        console.error("[PDFViewer] Error:", err.message);
        setError(err.message);
        setLoading(false);
        hasLoadedRef.current = null; // Allow retry
    }, []);

    const handleExternalOpen = () => {
        if (url) window.open(url, '_blank');
    };

    // Always have a valid width for rendering - use a reasonable minimum
    const renderWidth = Math.max(containerWidth - 48, 300);

    if (!url) {
        return (
            <div className="h-full flex items-center justify-center text-gray-400 bg-gray-50">
                <p>Kein Dokument ausgewählt</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white overflow-hidden relative" ref={containerRef}>
            {/* Toolbar */}
            <div className="bg-white border-b border-gray-100 p-2 flex items-center justify-between shrink-0 z-20 shadow-sm overflow-x-auto">
                <div className="flex items-center gap-3">
                    {!isContinuous && (
                        <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg p-1 border border-gray-100">
                            <button
                                onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                                disabled={pageNumber <= 1}
                                className="p-1 rounded hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <span className="text-xs font-bold min-w-[50px] text-center text-gray-700">
                                {pageNumber} / {numPages || '-'}
                            </span>
                            <button
                                onClick={() => setPageNumber(p => Math.min(numPages || 1, p + 1))}
                                disabled={!numPages || pageNumber >= numPages}
                                className="p-1 rounded hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    )}

                    <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg p-1 border border-gray-100 ml-1">
                        <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="p-1 rounded hover:bg-white hover:shadow-sm transition-all">
                            <ZoomOut size={16} />
                        </button>
                        <span className="text-[10px] font-black w-10 text-center text-gray-600 uppercase">{Math.round(scale * 100)}%</span>
                        <button onClick={() => setScale(s => Math.min(3.0, s + 0.1))} className="p-1 rounded hover:bg-white hover:shadow-sm transition-all">
                            <ZoomIn size={16} />
                        </button>
                    </div>

                    <button
                        onClick={() => setIsContinuous(!isContinuous)}
                        className={cn(
                            "hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all border",
                            isContinuous
                                ? "bg-black text-white border-black shadow-md"
                                : "bg-white text-gray-500 border-gray-100 hover:border-gray-200"
                        )}
                    >
                        {isContinuous ? "Einzelseiten" : "Endlos"}
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    {showAIFeatures() && (
                        <>
                            {extractedText && (
                                <button
                                    onClick={() => {
                                        setAiInitialMessage("Zusammenfasse dieses Dokument für mich in Stichpunkten.");
                                        setIsAIChatOpen(true);
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-tr from-blue-600 to-blue-500 text-white hover:shadow-lg hover:shadow-blue-100 transition-all font-bold text-[10px] uppercase tracking-wider shadow-sm"
                                >
                                    <Sparkles size={14} />
                                    KI-Hilfe
                                </button>
                            )}
                            <FlashcardGenButton
                                pdfText={extractedText}
                                topicId={topicId || 'materials'}
                                onSuccess={(cards) => {
                                    setFlashcards(cards);
                                    setIsFlashcardViewerOpen(true);
                                }}
                            />
                        </>
                    )}

                    <button
                        onClick={handleExternalOpen}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        title="In externem Browser öffnen"
                    >
                        <ExternalLink size={18} />
                    </button>
                </div>
            </div>

            {/* Main Viewer Area */}
            <div className="flex-1 bg-gray-100 overflow-auto relative flex justify-center p-4">
                {loading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10 transition-opacity">
                        <Loader2 className="animate-spin text-blue-600 mb-3" size={32} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Lädt PDF...</span>
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10 p-6 text-center">
                        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
                            <AlertCircle size={32} />
                        </div>
                        <h3 className="font-bold text-gray-900 mb-2">Ups! Ein Fehler ist aufgetreten.</h3>
                        <p className="text-gray-500 text-sm max-w-sm mb-6">{error}</p>
                        <button
                            onClick={handleExternalOpen}
                            className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-2xl font-bold text-sm hover:scale-105 transition-all shadow-xl"
                        >
                            <ExternalLink size={18} />
                            Extern öffnen
                        </button>
                    </div>
                )}

                {/* Only render when ready to prevent blank canvas */}
                {forceRenderPhase !== 'idle' && (
                    <Document
                        file={url}
                        onLoadSuccess={onDocumentLoadSuccess}
                        onLoadError={onDocumentLoadError}
                        loading={null}
                        error={null}
                        className="transition-opacity duration-300"
                    >
                        {forceRenderPhase === 'ready' && (
                            isContinuous ? (
                                <div className="flex flex-col gap-6 items-center">
                                    {Array.from(new Array(numPages), (_, index) => (
                                        <div key={`page_${index + 1}`} className="shadow-2xl border border-gray-200 bg-white">
                                            <Page
                                                pageNumber={index + 1}
                                                width={renderWidth}
                                                scale={scale}
                                                renderTextLayer={true}
                                                renderAnnotationLayer={true}
                                                loading={<div style={{ width: renderWidth, height: renderWidth * 1.4 }} className="bg-gray-50 animate-pulse" />}
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="shadow-2xl border border-gray-200 bg-white">
                                    <Page
                                        pageNumber={pageNumber}
                                        width={renderWidth}
                                        scale={scale}
                                        renderTextLayer={true}
                                        renderAnnotationLayer={true}
                                        loading={<div style={{ width: renderWidth, height: renderWidth * 1.4 }} className="bg-gray-50 animate-pulse" />}
                                    />
                                </div>
                            )
                        )}
                    </Document>
                )}
            </div>

            <AIChatWindow
                isOpen={isAIChatOpen}
                onClose={() => setIsAIChatOpen(false)}
                context={extractedText}
                initialMessage={aiInitialMessage}
                images={pageImages}
                topicId={topicId}
            />

            <FlashcardViewer
                isOpen={isFlashcardViewerOpen}
                onClose={() => setIsFlashcardViewerOpen(false)}
                flashcards={flashcards}
                title={`Karteikarten`}
                topicId={topicId}
            />
        </div>
    );
}
