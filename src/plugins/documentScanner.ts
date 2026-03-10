/**
 * Document Scanner Plugin
 * ========================
 * TypeScript wrapper for the native iOS document scanner.
 * Uses VisionKit's VNDocumentCameraViewController on iOS.
 * Returns scanned pages as a single PDF.
 */

import { registerPlugin, Capacitor } from '@capacitor/core';

export interface DocumentScannerPlugin {
    scanDocument(): Promise<{
        filePath: string;
        fileName: string;
        pageCount: number;
        base64Data: string;
        mimeType: string;
    }>;
}

let DocumentScanner: DocumentScannerPlugin;

if (typeof window !== 'undefined') {
    const RawPlugin = registerPlugin<DocumentScannerPlugin>('DocumentScanner');
    DocumentScanner = {
        scanDocument: async () => {
            if (Capacitor.getPlatform() === 'web') {
                throw new Error("Der Apple Scanner ist im Browser nicht verfügbar. Bitte nutze die iOS-App.");
            }
            try {
                return await RawPlugin.scanDocument();
            } catch (err: any) {
                if (err?.message?.includes('not implemented')) {
                    throw new Error("Das Scanner Plugin fehlt! Bitte lade die App über Xcode neu auf dein iPhone (Product -> Run), damit die nativen Swift-Dateien kompiliert werden.");
                }
                throw err;
            }
        }
    };
} else {
    DocumentScanner = {
        scanDocument: async () => {
            throw new Error("Document Scanner is not available on the server");
        }
    };
}

export default DocumentScanner;
