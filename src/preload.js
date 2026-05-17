const { contextBridge, ipcRenderer } = require('electron');

// We are exposing a controlled API to the renderer process (Svelte).
// The renderer process cannot access Node.js APIs directly for security reasons.
contextBridge.exposeInMainWorld('electronAPI', {
    // Define functions that the renderer can call.
    // These functions will securely send messages to the main process.
    
    // Example: A function to get the app version
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),

    // File operations
    saveProject: (projectData, projectName, filePath = null) => ipcRenderer.invoke('save-project', projectData, projectName, filePath),
    loadProject: () => ipcRenderer.invoke('load-project'),
    loadTextFile: () => ipcRenderer.invoke('load-text-file'),
    saveHtmlGame: (htmlContent, projectName) => ipcRenderer.invoke('save-html-game', htmlContent, projectName),
    openImageFile: () => ipcRenderer.invoke('open-image-file'),
    readImageBase64: (urlOrPath) => ipcRenderer.invoke('read-image-base64', urlOrPath),

    // --- Listener for Main Process -> Renderer Process Communication ---
    on: (channel, callback) => {
        // Whitelist channels to prevent security issues
        const validChannels = ['save-project', 'load-project'];
        if (validChannels.includes(channel)) {
            // Deliberately strip event as it includes `sender`
            ipcRenderer.on(channel, (event, ...args) => callback(...args));
        }
    }
});
