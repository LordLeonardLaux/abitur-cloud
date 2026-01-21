"use client";

import { useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure worker - must use https:// for Capacitor WebView compatibility
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
    url: string | null;
}

export default function PDFViewer({ url }: PDFViewerProps) {
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [scale, setScale] = useState<number>(1.0);
    const [containerWidth, setContainerWidth] = useState<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);

    // Initial width detection
    useEffect(() => {
        if (!containerRef.current) return;

        const resizeObserver = new ResizeObserver((entries) => {
            if (entries[0]) {
                setContainerWidth(entries[0].contentRect.width);
            }
        });

        resizeObserver.observe(containerRef.current);

        // Initial set
        setContainerWidth(containerRef.current.clientWidth);

        return () => resizeObserver.disconnect();
    }, []);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
        setPageNumber(1);
        setLoading(false);
    }

    function changePage(offset: number) {
        setPageNumber(prev => Math.min(Math.max(1, prev + offset), numPages || 1));
    }

    if (!url) {
        return <div className="h-full flex items-center justify-center text-gray-400">Kein Dokument ausgewählt</div>;
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 overflow-hidden" ref={containerRef}>
            {/* Toolbar */}
            <div className="bg-white border-b border-gray-200 p-2 flex items-center justify-between shrink-0 z-10 shadow-sm">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => changePage(-1)}
                        disabled={pageNumber <= 1}
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <span className="text-sm font-medium min-w-[60px] text-center">
                        {pageNumber} / {numPages || '-'}
                    </span>
                    <button
                        onClick={() => changePage(1)}
                        disabled={!numPages || pageNumber >= numPages}
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="p-1 rounded hover:bg-gray-100">
                        <ZoomOut size={18} />
                    </button>
                    <span className="text-xs font-medium w-12 text-center">{Math.round(scale * 100)}%</span>
                    <button onClick={() => setScale(s => Math.min(3.0, s + 0.1))} className="p-1 rounded hover:bg-gray-100">
                        <ZoomIn size={18} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto relative flex justify-center p-4">
                <Document
                    file={url}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadStart={() => setLoading(true)}
                    loading={
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="animate-spin text-blue-600" size={32} />
                        </div>
                    }
                    error={
                        <div className="flex items-center justify-center h-full text-red-500 text-sm p-4 text-center">
                            PDF konnte nicht geladen werden.
                        </div>
                    }
                    className="shadow-lg"
                >
                    {/* Render Page only if we have a valid width to avoid layout thrashing */}
                    {containerWidth > 0 && (
                        <Page
                            pageNumber={pageNumber}
                            width={containerWidth - 32} // Subtract padding
                            scale={scale}
                            renderTextLayer={true}
                            renderAnnotationLayer={true}
                            className="bg-white"
                        />
                    )}
                </Document>
            </div>
        </div>
    );
}
