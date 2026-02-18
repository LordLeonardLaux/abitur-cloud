import { jsPDF } from 'jspdf';

export interface Flashcard {
    front: string;
    back: string;
}

interface FlashcardPdfOptions {
    title?: string;
    sourceTopicId?: string;
    sourceMaterialId?: string;
}

/**
 * Generates a beautiful A5 landscape PDF with flashcards.
 * Two cards per page: Front on top half, Back on bottom half.
 */
export function generateFlashcardPdf(
    flashcards: Flashcard[],
    options: FlashcardPdfOptions = {}
): jsPDF {
    // A5 landscape: 210mm x 148mm
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a5',
    });

    const pageWidth = 210;
    const pageHeight = 148;
    const margin = 12;
    const cardHeight = (pageHeight - margin * 3) / 2; // Two cards per page

    // Colors
    const primaryColor: [number, number, number] = [59, 130, 246]; // Blue-500
    const secondaryColor: [number, number, number] = [99, 102, 241]; // Indigo-500
    const textColor: [number, number, number] = [31, 41, 55]; // Gray-800
    const lightGray: [number, number, number] = [243, 244, 246]; // Gray-100

    // Title page
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Gradient overlay
    for (let i = 0; i < pageHeight; i++) {
        const ratio = i / pageHeight;
        const r = Math.round(primaryColor[0] + (secondaryColor[0] - primaryColor[0]) * ratio);
        const g = Math.round(primaryColor[1] + (secondaryColor[1] - primaryColor[1]) * ratio);
        const b = Math.round(primaryColor[2] + (secondaryColor[2] - primaryColor[2]) * ratio);
        doc.setFillColor(r, g, b);
        doc.rect(0, i, pageWidth, 1, 'F');
    }

    // Title text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text(options.title || 'Karteikarten', pageWidth / 2, pageHeight / 2 - 15, { align: 'center' });

    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(`${flashcards.length} Karten`, pageWidth / 2, pageHeight / 2 + 5, { align: 'center' });

    doc.setFontSize(10);
    doc.text('Erstellt mit Abitur Cloud', pageWidth / 2, pageHeight / 2 + 20, { align: 'center' });

    // Generate flashcard pages
    for (let i = 0; i < flashcards.length; i++) {
        doc.addPage();
        const card = flashcards[i];

        // Card number badge
        doc.setFillColor(...primaryColor);
        doc.roundedRect(margin, margin - 4, 20, 8, 4, 4, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(`${i + 1}/${flashcards.length}`, margin + 10, margin + 1, { align: 'center' });

        // FRONT card (top half)
        doc.setFillColor(...lightGray);
        doc.roundedRect(margin, margin + 6, pageWidth - margin * 2, cardHeight - 4, 4, 4, 'F');

        // Front label
        doc.setFillColor(...primaryColor);
        doc.roundedRect(margin + 8, margin + 12, 24, 6, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.text('FRAGE', margin + 20, margin + 16, { align: 'center' });

        // Front text
        doc.setTextColor(...textColor);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        const frontLines = doc.splitTextToSize(card.front, pageWidth - margin * 4);
        const frontY = margin + 28;
        doc.text(frontLines, pageWidth / 2, frontY, { align: 'center', maxWidth: pageWidth - margin * 4 });

        // BACK card (bottom half)
        const backY = margin + cardHeight + 4;
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(margin, backY, pageWidth - margin * 2, cardHeight - 4, 4, 4, 'FD');

        // Back label
        doc.setFillColor(...secondaryColor);
        doc.roundedRect(margin + 8, backY + 6, 32, 6, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.text('ANTWORT', margin + 24, backY + 10, { align: 'center' });

        // Back text
        doc.setTextColor(...textColor);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        const backLines = doc.splitTextToSize(card.back, pageWidth - margin * 4);
        const backTextY = backY + 22;
        doc.text(backLines, margin + 8, backTextY, { maxWidth: pageWidth - margin * 4 });
    }

    return doc;
}

/**
 * Saves the PDF to a Blob for download.
 */
export function flashcardPdfToBlob(doc: jsPDF): Blob {
    return doc.output('blob');
}

/**
 * Triggers a download of the flashcard PDF.
 */
export function downloadFlashcardPdf(flashcards: Flashcard[], options: FlashcardPdfOptions = {}): void {
    const doc = generateFlashcardPdf(flashcards, options);
    const filename = `${options.title || 'Karteikarten'}.pdf`.replace(/[^a-zA-Z0-9äöüÄÖÜß\-_. ]/g, '');
    doc.save(filename);
}
