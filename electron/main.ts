import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import serve from 'electron-serve';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const loadURL = serve({ directory: 'out' });

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
