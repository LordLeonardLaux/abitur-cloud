import { contextBridge } from 'electron';

// Expose minimal APIs if needed, otherwise this can be empty
contextBridge.exposeInMainWorld('electron', {
    platform: process.platform,
});
