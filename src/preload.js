// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('overlayAPI', {
  // ignore=true => clicks/scrolls pass through to the desktop below.
  // ignore=false => the overlay window captures all mouse input.
  setClickThrough: (ignore) => ipcRenderer.send('set-click-through', ignore),
  closeOverlay: () => ipcRenderer.send('close-overlay'),
  onToggleDrawMode: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('toggle-draw-mode', listener);
    return () => ipcRenderer.removeListener('toggle-draw-mode', listener);
  },
});