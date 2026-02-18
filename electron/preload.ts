import { contextBridge, ipcRenderer } from 'electron';

// Expose minimal APIs if needed, otherwise this can be empty
contextBridge.exposeInMainWorld('electron', {
    platform: process.platform,
    aiChat: (data: any) => ipcRenderer.invoke('ai-chat', data),
    aiFlashcards: (data: any) => ipcRenderer.invoke('ai-flashcards', data),
});
