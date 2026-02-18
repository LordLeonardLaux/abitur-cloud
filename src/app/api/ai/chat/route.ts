import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { NextResponse } from "next/server";

// Initialize Gemini with the API Key from environment variables
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const SYSTEM_PROMPT = `Du bist die Abitur Cloud Lernhilfe, ein hilfreicher KI-Assistent für Schüler der Oberstufe. 
Dein Ziel ist es, Schülern beim Verständnis von Lerninhalten zu helfen, Konzepte zu erklären und Fragen zu den Unterrichtsmaterialien zu beantworten.
Bleibe sachlich, freundlich und unterstützend. Erkläre komplexe Sachverhalte einfach und verständlich.
Wenn du Bilder von handgeschriebenen Notizen, Diagrammen oder PDF-Seiten erhältst, analysiere diese sorgfältig.
Beziehe dich auf die visuellen Inhalte, wenn sie relevant sind.`;

// Use vision-capable model when images are present
const getModel = (hasImages: boolean) => genAI.getGenerativeModel({
    model: hasImages ? "gemini-2.0-flash" : "gemini-1.5-flash",
    systemInstruction: SYSTEM_PROMPT
});

export async function POST(req: Request) {
    try {
        const { messages, context, images } = await req.json();

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json(
                { error: "Gemini API Key is not configured on the server." },
                { status: 500 }
            );
        }

        const hasImages = images && Array.isArray(images) && images.length > 0;
        const model = getModel(hasImages);

        // Prepare history for Gemini chat (text only for history)
        const history = messages.slice(0, -1).map((m: any) => ({
            role: m.role === "user" ? "user" : "model",
            parts: [{ text: m.content }],
        }));

        const chatSession = model.startChat({
            history: history,
            generationConfig: {
                maxOutputTokens: 4096,
            },
        });

        const currentMessage = messages[messages.length - 1].content;

        // Build multimodal parts
        const parts: Part[] = [];

        // Add context if available
        if (context) {
            parts.push({ text: `KONTEXT AUS DEM LERNMATERIAL:\n${context}\n\n` });
        }

        // Add images if available (for vision analysis)
        if (hasImages) {
            parts.push({ text: "BILDER DER PDF-SEITEN (zur visuellen Analyse):\n" });

            for (let i = 0; i < Math.min(images.length, 5); i++) {
                const imageData = images[i];
                // Expect format: { base64: "...", mimeType: "image/png" }
                if (imageData.base64 && imageData.mimeType) {
                    parts.push({
                        inlineData: {
                            data: imageData.base64.replace(/^data:image\/\w+;base64,/, ''),
                            mimeType: imageData.mimeType
                        }
                    });
                    parts.push({ text: `[Seite ${i + 1}]\n` });
                }
            }
        }

        // Add the user's question
        parts.push({ text: `\nFRAGE DES SCHÜLERS:\n${currentMessage}` });

        const result = await chatSession.sendMessage(parts);
        const responseText = result.response.text();

        return NextResponse.json({ content: responseText });
    } catch (error: any) {
        console.error("Gemini API Error:", error);
        return NextResponse.json(
            { error: "Error communicating with Gemini AI: " + error.message },
            { status: 500 }
        );
    }
}
