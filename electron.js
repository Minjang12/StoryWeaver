const { app, BrowserWindow, ipcMain, dialog, protocol, Menu } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs'); // File System module

// Cache errors workaround
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-gpu-cache');

function createWindow () {
  // 브라우저 창을 생성합니다.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true, // This hides the menu bar by default
    webPreferences: {
      // Use a preload script to securely expose Node.js functionality
      // to the renderer process.
      preload: path.join(__dirname, 'src/preload.js'),
      // Isolate the renderer process from the main process for security.
      contextIsolation: true,
      // Disable Node.js integration in the renderer process.
      nodeIntegration: false,
    }
  });

  // Svelte 앱의 index.html 파일을 로드합니다.
  // 개발 모드에서는 live-reload를 위해 localhost를 사용하고,
  // 프로덕션 모드에서는 빌드된 파일을 직접 로드합니다.
  const startUrl = process.env.ELECTRON_START_URL || url.format({
    pathname: path.join(__dirname, 'public/index.html'),
    protocol: 'file:',
    slashes: true
  });
  mainWindow.loadURL(startUrl);

  // 개발자 도구를 엽니다. (개발 시에만 유용)
  // mainWindow.webContents.openDevTools();
}

// 이 메소드는 Electron의 초기화가 완료되고
// 브라우저 창을 생성할 준비가 되었을 때 호출됩니다.
app.whenReady().then(() => {
  // Register a custom protocol to safely serve local files
  protocol.registerFileProtocol('story-asset', (request, callback) => {
    try {
      let filePath = new URL(request.url).pathname;
      // On Windows, pathname starts with a slash (e.g., /C:/...), which needs to be removed.
      if (process.platform === 'win32') {
        filePath = filePath.substr(1);
      }
      callback({ path: path.normalize(decodeURI(filePath)) });
    } catch (error) {
      console.error(`Failed to handle 'story-asset' protocol for URL: ${request.url}`, error);
      callback({ error: -6 }); // FILE_NOT_FOUND
    }
  });

  createWindow();

  // --- Application Menu ---
  const menuTemplate = [
    {
      label: '파일',
      submenu: [
        {
          label: '프로젝트 저장',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send('save-project');
            }
          }
        },
        {
          label: '프로젝트 불러오기',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send('load-project');
            }
          }
        },
        { type: 'separator' },
        { role: 'quit', label: '종료' }
      ]
    },
    {
      label: '개발',
      submenu: [
        {
          label: '개발자 도구 토글',
          accelerator: 'F12',
          click: (item, focusedWindow) => {
            if (focusedWindow) {
              focusedWindow.webContents.toggleDevTools();
            }
          }
        }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  app.on('activate', function () {
    // macOS에서는 dock 아이콘이 클릭되고 다른 창이 열려있지 않을 때
    // 앱에서 창을 다시 생성하는 것이 일반적입니다.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// 모든 창이 닫혔을 때 앱을 종료합니다. (macOS 제외)
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC Handlers for Renderer Process ---
// This is where we'll handle file operations securely.

// Example IPC handler
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('save-project', async (event, projectData, projectName, targetFilePath = null) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  
  // If a target path is provided, save directly (Overwrite)
  if (targetFilePath) {
    try {
      fs.writeFileSync(targetFilePath, JSON.stringify(projectData, null, 2), 'utf-8');
      return { success: true, filePath: targetFilePath };
    } catch (error) {
      console.error('Failed to save project:', error);
      return { success: false, error: error.message };
    }
  }

  // Otherwise, Open "Save As" Dialog
  // Sanitize the project name to create a safe filename (allows Korean characters)
  const safeProjectName = projectName.replace(/[^a-z0-9-_\u3131-\uD79D]/gi, '_');

  const { filePath } = await dialog.showSaveDialog(window, {
    title: '프로젝트 저장',
    defaultPath: `${safeProjectName}.json`,
    filters: [
      { name: 'StoryWeaver Project', extensions: ['json'] }
    ]
  });

  if (filePath) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(projectData, null, 2), 'utf-8');
      return { success: true, filePath: filePath };
    } catch (error) {
      console.error('Failed to save project:', error);
      return { success: false, error: error.message };
    }
  }
  return { success: false, cancelled: true };
});

ipcMain.handle('load-project', async (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  const { filePaths } = await dialog.showOpenDialog(window, {
    title: '프로젝트 불러오기',
    properties: ['openFile'],
    filters: [
      { name: 'StoryWeaver Project', extensions: ['json'] }
    ]
  });

  if (filePaths && filePaths.length > 0) {
    try {
      const data = fs.readFileSync(filePaths[0], 'utf-8');
      return { success: true, projectData: JSON.parse(data), filePath: filePaths[0] };
    } catch (error) {
      console.error('Failed to load project:', error);
      return { success: false, error: error.message };
    }
  }
  return { success: false, cancelled: true };
});

ipcMain.handle('load-text-file', async (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  const { filePaths } = await dialog.showOpenDialog(window, {
    title: '텍스트 파일 불러오기',
    properties: ['openFile'],
    filters: [
      { name: 'Text Files', extensions: ['txt', 'md'] }
    ]
  });

  if (filePaths && filePaths.length > 0) {
    try {
      const data = fs.readFileSync(filePaths[0], 'utf-8');
      const fileName = path.basename(filePaths[0]);
      return { success: true, textData: data, fileName: fileName };
    } catch (error) {
      console.error('Failed to load text file:', error);
      return { success: false, error: error.message };
    }
  }
  return { success: false, cancelled: true };
});

ipcMain.handle('save-html-game', async (event, htmlContent, projectName) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const safeProjectName = projectName.replace(/[^a-z0-9-_\u3131-\uD79D]/gi, '_');

    const { filePath } = await dialog.showSaveDialog(window, {
        title: 'HTML 게임으로 저장',
        defaultPath: `${safeProjectName}.html`,
        filters: [
            { name: 'HTML Game', extensions: ['html'] }
        ]
    });

    if (filePath) {
        try {
            fs.writeFileSync(filePath, htmlContent, 'utf-8');
            return { success: true, filePath: filePath };
        } catch (error) {
            console.error('Failed to save HTML game:', error);
            return { success: false, error: error.message };
        }
    }
    return { success: false, cancelled: true };
});

ipcMain.handle('open-image-file', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const { filePaths } = await dialog.showOpenDialog(window, {
        title: '프로필 이미지 선택',
        properties: ['openFile'],
        filters: [
            { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif'] }
        ]
    });

    if (filePaths && filePaths.length > 0) {
        const filePath = filePaths[0];
        // Convert backslashes to forward slashes for URL compatibility
        const normalizedPath = filePath.replace(/\\/g, '/');
        // Use triple slashes for a valid file URL structure
        return { success: true, filePath: `story-asset:///${normalizedPath}` };
    }
    return { success: false, cancelled: true };
});

ipcMain.handle('read-image-base64', async (event, urlOrPath) => {
    try {
        let filePath = urlOrPath;
        if (filePath.startsWith('story-asset:///')) {
             filePath = decodeURI(filePath.replace('story-asset:///', ''));
             // Handle Windows drive letters if needed (e.g. "C:/...")
             // decodeURI might leave it as "C:/Users..." which is fine for fs.readFile
        } else if (filePath.startsWith('story-asset://')) { // catch double slash just in case
             filePath = decodeURI(filePath.replace('story-asset://', ''));
        }
        
        // Normalize for OS
        filePath = path.normalize(filePath);

        const ext = path.extname(filePath).toLowerCase().substring(1);
        const mimeTypes = {
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'svg': 'image/svg+xml'
        };
        const mimeType = mimeTypes[ext] || 'application/octet-stream';
        
        const data = fs.readFileSync(filePath);
        const base64 = data.toString('base64');
        return { success: true, dataUri: `data:${mimeType};base64,${base64}` };
    } catch (error) {
        console.error('Failed to read image as base64:', error);
        return { success: false, error: error.message };
    }
});
