import { app, BrowserWindow, ipcMain, screen, globalShortcut } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let mainWindow;

const createWindow = () => {
  // Use the display's full bounds, not workAreaSize — workArea excludes the
  // taskbar/dock, which leaves a visible gap and makes it look like a normal
  // bounded window instead of a true edge-to-edge overlay.
  const { x, y, width, height } = screen.getPrimaryDisplay().bounds;

  mainWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    transparent: true,
    // A fully-transparent backgroundColor (not just `transparent: true`) avoids
    // Electron painting an opaque rect for the first frame on some platforms.
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false, // avoid a flash of the (possibly opaque) first frame
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setBounds({ x, y, width, height });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
};

app.whenReady().then(() => {
  createWindow();

  // Global hotkey to flip between "drawing" (window eats all mouse input)
  // and "click-through" (mouse passes through to whatever is beneath it),
  // so the user can still use their desktop without closing the overlay.
  globalShortcut.register('CommandOrControl+Shift+D', () => {
    mainWindow?.webContents.send('toggle-draw-mode');
  });

  // Emergency quit, in case the overlay ever eats all input.
  globalShortcut.register('CommandOrControl+Shift+Q', () => {
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Renderer asks us to toggle whether the OS routes mouse events to this
// window at all. `forward: true` still lets us receive mousemove/enter/leave
// so the renderer can redraw a cursor preview even while click-through.
ipcMain.on('set-click-through', (_event, ignore) => {
  mainWindow?.setIgnoreMouseEvents(ignore, { forward: true });
});

ipcMain.on('close-overlay', () => {
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});