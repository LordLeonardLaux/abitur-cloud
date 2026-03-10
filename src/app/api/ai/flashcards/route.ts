import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const FLASHCARD_PROMPT = `Du bist ein Experte für die Erstellung von Lernmaterialien. 
Erstelle aus dem folgenden Text hochwertige Karteikarten für das Abitur.
Jede Karteikarte muss eine Frage (front) und eine Antwort (back) haben.
Die Antwort sollte präzise, aber umfassend sein.
Gib das Ergebnis ausschließlich als JSON-Array von Objekten im folgenden Format zurück:
[
  { "front": "Frage...", "back": "Antwort..." },
  ...
]`;

export async function POST(req: Request) {
    try {
        const { content, aiSettings } = await req.json();

        let apiKey = null;
        let modelName = "gemini-2.5-pro";

        if (aiSettings?.enabled && aiSettings.apiKey) {
            apiKey = aiSettings.apiKey;
            if (aiSettings.model) modelName = aiSettings.model;
        }

        if (!apiKey) {
            return NextResponse.json(
                { error: "Bitte hinterlege zuerst deinen eigenen KI-API-Schlüssel in den Einstellungen." },
                { status: 400 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: FLASHCARD_PROMPT,
            generationConfig: {
                responseMimeType: "application/json",
            }
        });

        if (!content || content.length < 50) {
            return NextResponse.json(
                { error: "Der bereitgestellte Text ist zu kurz für die Erstellung von Karteikarten." },
                { status: 400 }
            );
        }

        const prompt = `${FLASHCARD_PROMPT}\n\nLerninhalt:\n${content}`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        try {
            const flashcards = JSON.parse(responseText);
            return NextResponse.json({ flashcards });
        } catch (parseError) {
            console.error("JSON Parse Error:", responseText);
            return NextResponse.json(
                { error: "Das KI-Modell hat kein gültiges JSON zurückgegeben." },
                { status: 500 }
            );
        }
    } catch (error: any) {
        console.error("Gemini Flashcard Error:", error);
        return NextResponse.json(
            { error: "Fehler bei der Karteikarten-Generierung: " + error.message },
            { status: 500 }
        );
    }
}
