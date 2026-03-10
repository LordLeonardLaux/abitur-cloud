import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { NextResponse } from "next/server";

// Initialize Gemini with the API Key from environment variables
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const SYSTEM_PROMPT = `Du bist die Abitur Cloud Lernhilfe, ein hilfreicher KI-Assistent für Schüler der Oberstufe. 
Dein Ziel ist es, Schülern beim Verständnis von Lerninhalten zu helfen, Konzepte zu erklären und Fragen zu den Unterrichtsmaterialien zu beantworten.
Bleibe sachlich, freundlich und unterstützend. Erkläre komplexe Sachverhalte einfach und verständlich.
Wenn du Bilder von handgeschriebenen Notizen, Diagrammen oder PDF-Seiten erhältst, analysiere diese sorgfältig und transkribiere den handschriftlichen Inhalt.
Beziehe dich auf die visuellen Inhalte, wenn sie relevant sind.
WICHTIG: Verwende NIEMALS LaTeX-Notation (kein $, \\frac, \\vec, \\cdot etc.). Schreibe Mathematik immer in lesbarem Klartext mit Unicode-Zeichen. Beispiele: Statt $\\vec{a}$ schreibe →a, statt $\\frac{1}{2}$ schreibe 1/2, statt $\\cdot$ schreibe ·, statt $\\times$ schreibe ×.`;

// Use vision-capable model when images are present
const getModel = (hasImages: boolean, modelName: string = 'gemini-2.5-pro') => genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM_PROMPT
});

export async function POST(req: Request) {
    try {
        const { messages, context, images, aiSettings } = await req.json();

        let apiKey = null;
        let provider = 'gemini';
        let modelName = 'gemini-2.5-pro';

        if (aiSettings?.enabled && aiSettings.apiKey) {
            apiKey = aiSettings.apiKey;
            provider = aiSettings.provider;
            if (aiSettings.model) modelName = aiSettings.model;
        }

        if (!apiKey) {
            return NextResponse.json(
                { error: "Bitte hinterlege zuerst deinen eigenen KI-API-Schlüssel in den Einstellungen." },
                { status: 400 }
            );
        }

        const hasImages = images && Array.isArray(images) && images.length > 0;

        if (provider === 'openai') {
            // OpenAI implementation via REST
            let userText = messages[messages.length - 1].content;
            if (context) userText = `KONTEXT:\n${context}\n\nFRAGE:\n${userText}`;

            const openAiMessages = [
                { role: 'system', content: SYSTEM_PROMPT },
                ...messages.slice(0, -1).map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
                { role: 'user', content: userText }
            ];

            if (hasImages) {
                const contentArray: any[] = [{ type: 'text', text: userText }];
                for (let i = 0; i < Math.min(images.length, 5); i++) {
                    const img = images[i];
                    if (img.base64 && img.mimeType) {
                        contentArray.push({
                            type: 'image_url',
                            image_url: { url: `data:${img.mimeType};base64,${img.base64.replace(/^data:image\/\w+;base64,/, '')}` }
                        });
                    }
                }
                openAiMessages[openAiMessages.length - 1].content = contentArray as any;
            }

            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: hasImages ? 'gpt-4o' : 'gpt-4o-mini',
                    messages: openAiMessages
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                console.error("OpenAI API Error:", errorData);
                return NextResponse.json({ error: "Fehler mit OpenAI: " + (errorData.error?.message || "Unbekannt") }, { status: 500 });
            }
            const data = await res.json();
            return NextResponse.json({ content: data.choices[0].message.content });
        } else {
            // Gemini implementation
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: SYSTEM_PROMPT
            });

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
            const parts: Part[] = [];

            if (context) {
                parts.push({ text: `KONTEXT AUS DEM LERNMATERIAL:\n${context}\n\n` });
            }

            if (hasImages) {
                parts.push({ text: "BILDER DER PDF-SEITEN (zur visuellen Analyse):\n" });
                for (let i = 0; i < Math.min(images.length, 5); i++) {
                    const imageData = images[i];
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

            parts.push({ text: `\nFRAGE DES SCHÜLERS:\n${currentMessage}` });

            const result = await chatSession.sendMessage(parts);
            const responseText = result.response.text();

            return NextResponse.json({ content: responseText });
        }
    } catch (error: any) {
        console.error("AI API Error:", error);
        return NextResponse.json(
            { error: "Error communicating with AI: " + error.message },
            { status: 500 }
        );
    }
}
