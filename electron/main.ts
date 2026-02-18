import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import serve from 'electron-serve';
import * as dotenv from 'dotenv';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Load environment variables from .env file
import * as fs from 'fs';

let envPath = path.join(__dirname, '../.env');
if (!isDev) {
    // In production, electron-builder puts extraResources in the Resources folder
    envPath = path.join(process.resourcesPath, '.env');
}

if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    console.error("Critical: .env file not found at", envPath);
}

import { GoogleGenerativeAI } from "@google/generative-ai";

const loadURL = serve({ directory: 'out' });

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Log configuration for debugging
console.log("Environment Path:", envPath);
console.log("Gemini API Key configured:", !!process.env.GEMINI_API_KEY);
if (process.env.GEMINI_API_KEY) {
    console.log("Key Length:", process.env.GEMINI_API_KEY.length);
    console.log("Key starts with AIza:", process.env.GEMINI_API_KEY.startsWith("AIza"));
}

const SYSTEM_PROMPT = `Du bist die Abitur Cloud Lernhilfe, ein hilfreicher KI-Assistent für Schüler der Oberstufe. 
Dein Ziel ist es, Schülern beim Verständnis von Lerninhalten zu helfen, Konzepte zu erklären und Fragen zu den Unterrichtsmaterialien zu beantworten.
Bleibe sachlich, freundlich und unterstützend. Erkläre komplexe Sachverhalte einfach und verständlich.
Wenn du Informationen aus einem bereitgestellten PDF-Text erhältst, beziehe dich primär darauf.`;

const FLASHCARD_PROMPT = `Du bist ein Experte für die Erstellung von Lernmaterialien. 
Erstelle aus dem folgenden Text hochwertige Karteikarten für das Abitur.
Jede Karteikarte muss eine Frage (front) und eine Antwort (back) haben.
Die Antwort sollte präzise, aber umfassend sein.
Gib das Ergebnis ausschließlich als JSON-Array von Objekten im folgenden Format zurück:
[
  { "front": "Frage...", "back": "Antwort..." },
  ...
]`;

const modelChat = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: SYSTEM_PROMPT
});
const modelFlashcards = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: FLASHCARD_PROMPT,
    generationConfig: { responseMimeType: "application/json" }
});

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        titleBarStyle: 'hidden',
        trafficLightPosition: { x: 20, y: 20 },
        backgroundColor: '#ffffff',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false // Fix CORS issues with Supabase
        },
    });

    if (isDev) {
        win.loadURL('http://localhost:3000');
        win.webContents.openDevTools();
    } else {
        console.log("Loading production URL...");
        loadURL(win).then(() => {
            console.log("Production URL loaded successfully");
        }).catch(err => {
            console.error("Failed to load production URL:", err);
        });
        // DevTools disabled for production
    }

    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('Failed to load:', errorCode, errorDescription);
    });
}

// IPC Handlers for AI
ipcMain.handle('ai-chat', async (event, { messages, context }) => {
    try {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("Gemini API Key is not configured in .env file.");
        }

        const history = messages.slice(0, -1).map((m: any) => ({
            role: m.role === "user" ? "user" : "model",
            parts: [{ text: m.content }],
        }));

        const chatSession = modelChat.startChat({
            history: history,
            generationConfig: { maxOutputTokens: 2048 },
        });

        const currentMessage = messages[messages.length - 1].content;
        let prompt = currentMessage;
        if (context) {
            prompt = `KONTEXT AUS DEM LERNMATERIAL (PDF/THEMA):\n${context}\n\nFRAGE DES SCHÜLERS:\n${currentMessage}`;
        }

        const result = await chatSession.sendMessage(prompt);
        return { content: result.response.text() };
    } catch (error: any) {
        console.error("AI Chat Error:", error);
        return { error: error.message };
    }
});

ipcMain.handle('ai-flashcards', async (event, { content }) => {
    try {
        if (!process.env.GEMINI_API_KEY) throw new Error("API Key missing");

        const prompt = `${FLASHCARD_PROMPT} \n\nLerninhalt: \n${content} `;
        const result = await modelFlashcards.generateContent(prompt);
        const text = result.response.text();
        const flashcards = JSON.parse(text);
        return { flashcards };
    } catch (error: any) {
        console.error("AI Flashcards Error:", error);
        return { error: error.message };
    }
});

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
