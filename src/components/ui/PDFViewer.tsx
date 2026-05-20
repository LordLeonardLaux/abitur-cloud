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
    AlertCircle,
    LayoutGrid,
    Columns2,
    Square,
    ScrollText,
    FileText,
    BrainCircuit,
    MoreHorizontal
} from 'lucide-react';
import { showAIFeatures, isMobile } from '@/lib/platform';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { cn } from '@/lib/utils';
import { FlashcardGenButton } from '@/components/ai/FlashcardGenButton';
import AIChatWindow from '@/components/ai/AIChatWindow';
import FlashcardViewer from '@/components/ai/FlashcardViewer';
import { Flashcard } from '@/lib/flashcardPdfGenerator';
import { useAuth } from '@/contexts/AuthContext';

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

type LayoutMode = '1-page' | '2-page' | '4-page' | 'continuous';

interface PDFViewerProps {
    url: string | null;
    topicId?: string;
    renderToolbarExtra?: React.ReactNode;
    layoutMode?: LayoutMode;
    onLayoutModeChange?: (mode: LayoutMode) => void;
}

const layoutOptions: { mode: LayoutMode; icon: typeof Square; label: string }[] = [
    { mode: '1-page', icon: Square, label: '1 Seite' },
    { mode: '2-page', icon: Columns2, label: '2 Seiten' },
    { mode: '4-page', icon: LayoutGrid, label: '4 Seiten' },
    { mode: 'continuous', icon: ScrollText, label: 'Endlos' },
];

export default function PDFViewer({ url, topicId, renderToolbarExtra, layoutMode, onLayoutModeChange }: PDFViewerProps) {
    const { profile } = useAuth();
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [scale, setScale] = useState<number>(1.0);
    const [containerWidth, setContainerWidth] = useState<number>(getInitialWidth());
    const [containerHeight, setContainerHeight] = useState<number>(typeof window !== 'undefined' ? window.innerHeight - 120 : 600);
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerAreaRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [extractedText, setExtractedText] = useState<string>('');
    const [isAIChatOpen, setIsAIChatOpen] = useState(false);
    const [aiInitialMessage, setAiInitialMessage] = useState<string | undefined>(undefined);
    const [internalLayout, setInternalLayout] = useState<LayoutMode>('1-page');
    const activeLayout = layoutMode ?? internalLayout;
    const setActiveLayout = onLayoutModeChange ?? setInternalLayout;
    const [showLayoutPicker, setShowLayoutPicker] = useState(false);
    const layoutPickerRef = useRef<HTMLDivElement>(null);
    const [pageImages, setPageImages] = useState<Array<{ base64: string, mimeType: string }>>([]);
    const pdfDocRef = useRef<any>(null);
    const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
    const [isFlashcardViewerOpen, setIsFlashcardViewerOpen] = useState(false);

    // Track if we've already done the initial load for this URL to prevent loops
    const hasLoadedRef = useRef<string | null>(null);
    const [forceRenderPhase, setForceRenderPhase] = useState<'idle' | 'loading' | 'ready'>('idle');

    // Swipe-to-page state
    const [swipeDeltaX, setSwipeDeltaX] = useState(0);
    const swipeStartRef = useRef<{ x: number; y: number; time: number; pointerId: number } | null>(null);
    const swipeAxisRef = useRef<'horizontal' | 'vertical' | null>(null);

    // Mobile "more" popover (KI buttons + layout picker)
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const moreMenuRef = useRef<HTMLDivElement>(null);

    // Continuous-mode page tracking
    const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

    // Detect if the file is an image based on the URL extension or path
    const isImage = url ? /\.(jpeg|jpg|png|gif|webp)(\?.*)?$/i.test(url) : false;

    const pagesPerView = activeLayout === '1-page' ? 1 : activeLayout === '2-page' ? 2 : activeLayout === '4-page' ? 4 : (numPages || 1);

    // Close layout picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (layoutPickerRef.current && !layoutPickerRef.current.contains(e.target as Node)) {
                setShowLayoutPicker(false);
            }
        };
        if (showLayoutPicker) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showLayoutPicker]);

    // Close mobile "more" menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
                setShowMoreMenu(false);
            }
        };
        if (showMoreMenu) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showMoreMenu]);

    // Light haptic feedback on page swipe (only on native iOS via Capacitor Haptics, if installed)
    const triggerHaptic = useCallback(async () => {
        if (!isMobile()) return;
        try {
            // Optional plugin — may not be installed. Hide the import string from TS module resolution.
            const pkg = '@capacitor/haptics';
            const mod: any = await import(/* @vite-ignore */ /* webpackIgnore: true */ pkg).catch(() => null);
            if (mod?.Haptics?.impact) {
                await mod.Haptics.impact({ style: mod.ImpactStyle?.Light ?? 'LIGHT' });
            }
        } catch {
            // Haptics plugin not installed — silent skip
        }
    }, []);

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

    // ResizeObserver for width (container) + height (viewer area)
    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            const rect = entries[0]?.contentRect;
            if (rect && rect.width > 0) setContainerWidth(rect.width);
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!viewerAreaRef.current) return;
        const observer = new ResizeObserver((entries) => {
            const rect = entries[0]?.contentRect;
            if (rect && rect.height > 0) setContainerHeight(rect.height);
        });
        observer.observe(viewerAreaRef.current);
        return () => observer.disconnect();
    }, []);

    // Continuous-mode: track which page is most visible and reflect it in pageNumber
    useEffect(() => {
        if (activeLayout !== 'continuous' || !numPages || !viewerAreaRef.current) return;

        const observer = new IntersectionObserver(
            (entries) => {
                let best: { pageNum: number; ratio: number } | null = null;
                for (const entry of entries) {
                    const pn = Number((entry.target as HTMLElement).dataset.pageNum);
                    if (!pn) continue;
                    if (!best || entry.intersectionRatio > best.ratio) {
                        best = { pageNum: pn, ratio: entry.intersectionRatio };
                    }
                }
                if (best && best.ratio > 0.4) {
                    setPageNumber(best.pageNum);
                }
            },
            {
                root: viewerAreaRef.current,
                threshold: [0.25, 0.5, 0.75],
            }
        );

        // Observe each registered page div
        pageRefs.current.forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, [activeLayout, numPages, forceRenderPhase]);

    // Swipe-to-page handlers (pointer events — works on iOS Capacitor + Web)
    const SWIPE_THRESHOLD_PX = 60;
    const SWIPE_AXIS_LOCK_PX = 10;

    const goToPage = useCallback(
        (direction: 1 | -1) => {
            if (!numPages) return;
            setPageNumber((prev) => {
                const next = prev + direction * pagesPerView;
                if (next < 1 || next > numPages) return prev;
                triggerHaptic();
                return next;
            });
        },
        [numPages, pagesPerView, triggerHaptic]
    );

    const handlePointerDown = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (activeLayout === 'continuous' || isImage || !numPages || numPages <= 1) return;
            // Ignore non-primary pointer (e.g. right click) and stylus/pen interactions
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            swipeStartRef.current = {
                x: e.clientX,
                y: e.clientY,
                time: Date.now(),
                pointerId: e.pointerId,
            };
            swipeAxisRef.current = null;
        },
        [activeLayout, isImage, numPages]
    );

    const handlePointerMove = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            const start = swipeStartRef.current;
            if (!start || start.pointerId !== e.pointerId) return;
            const dx = e.clientX - start.x;
            const dy = e.clientY - start.y;

            // Lock axis once user has moved beyond a few px — prevents fighting vertical scroll
            if (swipeAxisRef.current === null) {
                if (Math.abs(dx) < SWIPE_AXIS_LOCK_PX && Math.abs(dy) < SWIPE_AXIS_LOCK_PX) return;
                swipeAxisRef.current = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'horizontal' : 'vertical';
            }

            if (swipeAxisRef.current === 'horizontal') {
                e.preventDefault?.();
                setSwipeDeltaX(dx);
            }
        },
        []
    );

    const finishSwipe = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            const start = swipeStartRef.current;
            if (!start || start.pointerId !== e.pointerId) {
                setSwipeDeltaX(0);
                return;
            }
            const dx = e.clientX - start.x;
            const dy = e.clientY - start.y;
            const wasHorizontal = swipeAxisRef.current === 'horizontal';
            swipeStartRef.current = null;
            swipeAxisRef.current = null;

            if (wasHorizontal && Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
                if (dx < 0) {
                    goToPage(1); // swipe left → next page
                } else {
                    goToPage(-1); // swipe right → previous page
                }
            }
            setSwipeDeltaX(0);
        },
        [goToPage]
    );

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

        if (isImage) return;

        console.log("[PDFViewer] Success:", pdf.numPages, "pages");
        hasLoadedRef.current = url;

        setNumPages(pdf.numPages);
        setPageNumber(1);
        setError(null);

        try {
            const page = await pdf.getPage(1);
            const { width, height } = page.getViewport({ scale: 1 });
            if (width > height && !layoutMode) setInternalLayout('continuous');
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
    }, [extractText, url, layoutMode]);

    const onDocumentLoadError = useCallback((err: Error) => {
        if (isImage) return;
        console.error("[PDFViewer] Error:", err.message);
        setError(err.message);
        setLoading(false);
        hasLoadedRef.current = null; // Allow retry
    }, [isImage]);

    const handleExternalOpen = () => {
        if (url) window.open(url, '_blank');
    };

    const getPageWidth = () => {
        const available = Math.max(containerWidth - 48, 300);
        // containerHeight is the viewer area (excluding toolbar), minus padding
        const availableHeight = Math.max(containerHeight - 32, 200);
        // A4 ratio: height = width * 1.414, so max width from height = height / 1.414
        const maxWidthFromHeight = (h: number) => h / 1.414;

        switch (activeLayout) {
            case '1-page': {
                const widthBased = Math.min(available * 0.65, 550);
                const heightBased = maxWidthFromHeight(availableHeight);
                return Math.min(widthBased, heightBased);
            }
            case '2-page': {
                const widthBased = Math.min((available - 32) / 2, 420);
                const heightBased = maxWidthFromHeight(availableHeight);
                return Math.min(widthBased, heightBased);
            }
            case '4-page': {
                const widthBased = Math.min((available - 32) / 2, 320);
                // 4-page has 2 rows, so each page gets half the height
                const heightBased = maxWidthFromHeight((availableHeight - 16) / 2);
                return Math.min(widthBased, heightBased);
            }
            case 'continuous': return Math.min(available * 0.65, 550);
            default: return available;
        }
    };
    const renderWidth = isImage ? Math.max(containerWidth - 48, 300) : getPageWidth();

    // Handle Image Loading
    useEffect(() => {
        if (isImage && url && url !== hasLoadedRef.current) {
            hasLoadedRef.current = url;
            setLoading(false);
            setError(null);

            // Pass the image directly to the AI Chat
            // We fetch the image and convert it to base64 so the AI Chat can send it to the LLM
            fetch(url)
                .then(response => response.blob())
                .then(blob => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64data = reader.result as string;
                        setPageImages([{
                            base64: base64data,
                            mimeType: blob.type || 'image/png'
                        }]);
                        setExtractedText('[Ein Bild wurde hochgeladen. Bitte betrachte das Bild.]');
                    }
                    reader.readAsDataURL(blob);
                })
                .catch(err => console.error("[PDFViewer] Could not convert image to base64 for AI:", err));
        }
    }, [url, isImage]);

    // Get current layout icon
    const currentLayoutOption = layoutOptions.find(o => o.mode === activeLayout) || layoutOptions[0];
    const CurrentLayoutIcon = currentLayoutOption.icon;

    // Page counter display — larger on touch devices
    const counterCls = "font-semibold text-gray-800 tabular-nums text-sm md:text-xs min-w-[64px] md:min-w-[50px] text-center";
    const renderPageCounter = () => {
        if (activeLayout === 'continuous') {
            return <span className={counterCls}>Seite {pageNumber} / {numPages || '-'}</span>;
        }
        const lastPage = Math.min(pageNumber + pagesPerView - 1, numPages || 1);
        if (pagesPerView === 1) {
            return <span className={counterCls}>{pageNumber} / {numPages || '-'}</span>;
        }
        return <span className={counterCls}>{pageNumber}-{lastPage} / {numPages || '-'}</span>;
    };

    if (!url) {
        return (
            <div className="h-full flex items-center justify-center text-gray-400 bg-gray-50">
                <p>Kein Dokument ausgewählt</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full max-h-[100dvh] bg-white overflow-hidden relative" ref={containerRef}>
            {/* Main Viewer Area */}
            <div
                ref={viewerAreaRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishSwipe}
                onPointerCancel={finishSwipe}
                style={{ touchAction: activeLayout === 'continuous' ? 'pan-y' : 'pan-y pinch-zoom' }}
                className={cn("flex-1 bg-gray-100 relative flex justify-center p-4", activeLayout === 'continuous' ? "overflow-auto" : "overflow-hidden items-center")}
            >
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

                {/* Image Rendering */}
                {isImage && (
                    <div className="flex justify-center items-start w-full h-full p-4 overflow-auto">
                        <img
                            src={url}
                            alt="Document Image"
                            style={{
                                width: `${renderWidth * scale}px`,
                                maxWidth: 'none',
                                objectFit: 'contain',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                                borderRadius: '0.5rem',
                                border: '1px solid #e5e7eb',
                                backgroundColor: 'white',
                                transition: 'width 0.2s ease-in-out'
                            }}
                        />
                    </div>
                )}

                {/* PDF Rendering */}
                {/* Only render when ready to prevent blank canvas */}
                {!isImage && forceRenderPhase !== 'idle' && (
                    <Document
                        file={url}
                        onLoadSuccess={onDocumentLoadSuccess}
                        onLoadError={onDocumentLoadError}
                        loading={null}
                        error={null}
                        className="transition-opacity duration-300"
                    >
                        {forceRenderPhase === 'ready' && (
                            activeLayout === 'continuous' ? (
                                <div className="flex flex-col gap-6 items-center">
                                    {Array.from(new Array(numPages), (_, index) => {
                                        const pn = index + 1;
                                        return (
                                            <div
                                                key={`page_${pn}`}
                                                data-page-num={pn}
                                                ref={(el) => {
                                                    if (el) pageRefs.current.set(pn, el);
                                                    else pageRefs.current.delete(pn);
                                                }}
                                                className="shadow-2xl border border-gray-200 bg-white"
                                            >
                                                <Page
                                                    pageNumber={pn}
                                                    width={renderWidth}
                                                    scale={scale}
                                                    renderTextLayer={true}
                                                    renderAnnotationLayer={true}
                                                    loading={<div style={{ width: renderWidth, height: renderWidth * 1.4 }} className="bg-gray-50 animate-pulse" />}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div
                                    className={cn(
                                        "flex items-start justify-center",
                                        activeLayout === '4-page' ? "flex-wrap gap-3 max-w-fit" : "gap-3"
                                    )}
                                    style={{
                                        transform: swipeDeltaX !== 0 ? `translateX(${swipeDeltaX * 0.4}px)` : undefined,
                                        transition: swipeDeltaX === 0 ? 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
                                        willChange: 'transform',
                                    }}
                                >
                                    {(() => {
                                        const pages: number[] = [];
                                        for (let i = 0; i < pagesPerView && pageNumber + i <= (numPages || 1); i++) {
                                            pages.push(pageNumber + i);
                                        }
                                        return pages.map(pn => (
                                            <div key={`page_${pn}`} className="shadow-2xl border border-gray-200 bg-white">
                                                <Page
                                                    pageNumber={pn}
                                                    width={renderWidth}
                                                    scale={scale}
                                                    renderTextLayer={true}
                                                    renderAnnotationLayer={true}
                                                    loading={<div style={{ width: renderWidth, height: renderWidth * 1.4 }} className="bg-gray-50 animate-pulse" />}
                                                />
                                            </div>
                                        ));
                                    })()}
                                </div>
                            )
                        )}
                    </Document>
                )}
            </div>

            {/* Toolbar - Bottom (sticky, safe-area aware) */}
            <div className="bg-white border-t border-gray-100 px-2 pt-2 pb-2 flex items-center justify-between shrink-0 sticky bottom-0 z-20 shadow-[0_-2px_8px_rgba(0,0,0,0.04)] gap-2"
                style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
            >
                {/* Left: Page Navigation */}
                <div className="flex items-center gap-2">
                    {renderToolbarExtra}

                    {activeLayout !== 'continuous' && !isImage && (
                        <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 border border-gray-100">
                            <button
                                onClick={() => { setPageNumber(p => Math.max(1, p - pagesPerView)); triggerHaptic(); }}
                                disabled={pageNumber <= 1}
                                aria-label="Vorherige Seite"
                                className="p-2.5 md:p-1 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all active:scale-95"
                            >
                                <ChevronLeft className="w-5 h-5 md:w-[18px] md:h-[18px]" />
                            </button>
                            {renderPageCounter()}
                            <button
                                onClick={() => { setPageNumber(p => Math.min(numPages || 1, p + pagesPerView)); triggerHaptic(); }}
                                disabled={!numPages || pageNumber + pagesPerView > numPages}
                                aria-label="Nächste Seite"
                                className="p-2.5 md:p-1 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all active:scale-95"
                            >
                                <ChevronRight className="w-5 h-5 md:w-[18px] md:h-[18px]" />
                            </button>
                        </div>
                    )}

                    {activeLayout === 'continuous' && !isImage && (
                        <div className="flex items-center bg-gray-50 rounded-lg px-3 py-2 md:py-1.5 border border-gray-100">
                            {renderPageCounter()}
                        </div>
                    )}
                </div>

                {/* Center: Zoom — hidden on small screens to save space (lives in More menu) */}
                <div className="hidden md:flex items-center gap-1.5 bg-gray-50 rounded-lg p-1 border border-gray-100">
                    <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="p-1 rounded hover:bg-white hover:shadow-sm transition-all">
                        <ZoomOut size={16} />
                    </button>
                    <span className="text-[10px] font-black w-10 text-center text-gray-600 uppercase">{Math.round(scale * 100)}%</span>
                    <button onClick={() => setScale(s => Math.min(3.0, s + 0.1))} className="p-1 rounded hover:bg-white hover:shadow-sm transition-all">
                        <ZoomIn size={16} />
                    </button>
                </div>

                {/* Right (Desktop): Layout Picker + AI Buttons + External */}
                <div className="hidden md:flex items-center gap-2">
                    {/* Layout Picker (Desktop) */}
                    {!isImage && (
                        <div className="relative" ref={layoutPickerRef}>
                            <button
                                onClick={() => setShowLayoutPicker(!showLayoutPicker)}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all border",
                                    showLayoutPicker
                                        ? "bg-black text-white border-black shadow-md"
                                        : "bg-white text-gray-500 border-gray-100 hover:border-gray-200"
                                )}
                            >
                                <CurrentLayoutIcon size={14} />
                                {currentLayoutOption.label}
                            </button>

                            {showLayoutPicker && (
                                <div className="absolute bottom-full mb-2 right-0 bg-white rounded-xl shadow-2xl border border-gray-100 p-1.5 min-w-[140px] z-50">
                                    {layoutOptions.map(({ mode, icon: Icon, label }) => (
                                        <button
                                            key={mode}
                                            onClick={() => {
                                                setActiveLayout(mode);
                                                setShowLayoutPicker(false);
                                                if (mode !== 'continuous') setPageNumber(1);
                                            }}
                                            className={cn(
                                                "flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-bold transition-all",
                                                activeLayout === mode
                                                    ? "bg-black text-white"
                                                    : "text-gray-600 hover:bg-gray-50"
                                            )}
                                        >
                                            <Icon size={14} />
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {showAIFeatures() && (
                        <>
                            {extractedText && (
                                <button
                                    onClick={() => {
                                        setAiInitialMessage(isImage ? "Erkläre mir dieses Bild." : "Zusammenfasse dieses Dokument für mich in Stichpunkten.");
                                        setIsAIChatOpen(true);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all text-xs font-medium shadow-sm backdrop-blur-sm"
                                >
                                    <Sparkles size={14} className="text-blue-500" />
                                    <span>KI-Chat</span>
                                </button>
                            )}
                            {!isImage && (
                                <FlashcardGenButton
                                    pdfText={extractedText}
                                    topicId={topicId || 'materials'}
                                    onSuccess={(cards) => {
                                        setFlashcards(cards);
                                        setIsFlashcardViewerOpen(true);
                                    }}
                                />
                            )}
                            {!isImage && extractedText && (
                                <button
                                    onClick={() => {
                                        setAiInitialMessage("Fasse dieses Dokument in klaren Stichpunkten zusammen. Hebe die wichtigsten Konzepte hervor.");
                                        setIsAIChatOpen(true);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all text-xs font-medium shadow-sm backdrop-blur-sm"
                                >
                                    <FileText size={14} className="text-emerald-500" />
                                    <span>Zusammenfassung</span>
                                </button>
                            )}
                            {!isImage && extractedText && (
                                <button
                                    onClick={() => {
                                        setAiInitialMessage("Erstelle 5 Multiple-Choice-Fragen zu diesem Dokument mit jeweils 4 Antwortmöglichkeiten. Markiere die richtige Antwort und erkläre warum sie korrekt ist.");
                                        setIsAIChatOpen(true);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all text-xs font-medium shadow-sm backdrop-blur-sm"
                                >
                                    <BrainCircuit size={14} className="text-violet-500" />
                                    <span>Quiz</span>
                                </button>
                            )}
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

                {/* Right (Mobile): single More button → popover */}
                <div className="flex md:hidden relative" ref={moreMenuRef}>
                    <button
                        onClick={() => setShowMoreMenu((v) => !v)}
                        aria-label="Mehr Optionen"
                        className={cn(
                            "p-2.5 rounded-lg border transition-all active:scale-95",
                            showMoreMenu ? "bg-gray-900 text-white border-gray-900" : "bg-gray-50 text-gray-700 border-gray-200"
                        )}
                    >
                        <MoreHorizontal size={20} />
                    </button>

                    {showMoreMenu && (
                        <div className="absolute bottom-full mb-2 right-0 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 min-w-[240px] z-50 space-y-1">
                            {/* Zoom row */}
                            <div className="flex items-center justify-between px-2 py-1.5">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Zoom</span>
                                <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 border border-gray-100">
                                    <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="p-1.5 rounded hover:bg-white">
                                        <ZoomOut size={14} />
                                    </button>
                                    <span className="text-[11px] font-bold w-10 text-center text-gray-700 tabular-nums">{Math.round(scale * 100)}%</span>
                                    <button onClick={() => setScale(s => Math.min(3.0, s + 0.1))} className="p-1.5 rounded hover:bg-white">
                                        <ZoomIn size={14} />
                                    </button>
                                </div>
                            </div>

                            {!isImage && (
                                <>
                                    <div className="h-px bg-gray-100 my-1" />
                                    <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">Layout</div>
                                    <div className="grid grid-cols-2 gap-1">
                                        {layoutOptions.map(({ mode, icon: Icon, label }) => (
                                            <button
                                                key={mode}
                                                onClick={() => {
                                                    setActiveLayout(mode);
                                                    if (mode !== 'continuous') setPageNumber(1);
                                                    setShowMoreMenu(false);
                                                }}
                                                className={cn(
                                                    "flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all",
                                                    activeLayout === mode
                                                        ? "bg-black text-white"
                                                        : "text-gray-700 hover:bg-gray-50 border border-gray-100"
                                                )}
                                            >
                                                <Icon size={14} />
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}

                            {showAIFeatures() && (extractedText || isImage) && (
                                <>
                                    <div className="h-px bg-gray-100 my-1" />
                                    <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">KI</div>
                                    {extractedText && (
                                        <button
                                            onClick={() => {
                                                setAiInitialMessage(isImage ? "Erkläre mir dieses Bild." : "Zusammenfasse dieses Dokument für mich in Stichpunkten.");
                                                setIsAIChatOpen(true);
                                                setShowMoreMenu(false);
                                            }}
                                            className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg hover:bg-gray-50 text-sm font-semibold text-gray-700"
                                        >
                                            <Sparkles size={16} className="text-blue-500" />
                                            KI-Chat
                                        </button>
                                    )}
                                    {!isImage && (
                                        <div className="px-1">
                                            <FlashcardGenButton
                                                pdfText={extractedText}
                                                topicId={topicId || 'materials'}
                                                onSuccess={(cards) => {
                                                    setFlashcards(cards);
                                                    setIsFlashcardViewerOpen(true);
                                                    setShowMoreMenu(false);
                                                }}
                                            />
                                        </div>
                                    )}
                                    {!isImage && extractedText && (
                                        <button
                                            onClick={() => {
                                                setAiInitialMessage("Fasse dieses Dokument in klaren Stichpunkten zusammen. Hebe die wichtigsten Konzepte hervor.");
                                                setIsAIChatOpen(true);
                                                setShowMoreMenu(false);
                                            }}
                                            className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg hover:bg-gray-50 text-sm font-semibold text-gray-700"
                                        >
                                            <FileText size={16} className="text-emerald-500" />
                                            Zusammenfassung
                                        </button>
                                    )}
                                    {!isImage && extractedText && (
                                        <button
                                            onClick={() => {
                                                setAiInitialMessage("Erstelle 5 Multiple-Choice-Fragen zu diesem Dokument mit jeweils 4 Antwortmöglichkeiten. Markiere die richtige Antwort und erkläre warum sie korrekt ist.");
                                                setIsAIChatOpen(true);
                                                setShowMoreMenu(false);
                                            }}
                                            className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg hover:bg-gray-50 text-sm font-semibold text-gray-700"
                                        >
                                            <BrainCircuit size={16} className="text-violet-500" />
                                            Quiz erstellen
                                        </button>
                                    )}
                                </>
                            )}

                            <div className="h-px bg-gray-100 my-1" />
                            <button
                                onClick={() => { handleExternalOpen(); setShowMoreMenu(false); }}
                                className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg hover:bg-gray-50 text-sm font-semibold text-gray-700"
                            >
                                <ExternalLink size={16} className="text-gray-500" />
                                Extern öffnen
                            </button>
                        </div>
                    )}
                </div>
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
