import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CLOSE_WINDOW,
  IPC_DRAW_MINIGAME,
  IPC_DEBUG_MODE,
  IPC_DEBUG_RUN_MINIGAME,
  IPC_MINIMIZE_WINDOW,
  IPC_PRESS_SPECIAL_KEY,
  IPC_RUN_MINIGAME,
  IPC_TYPE_CHARACTER,
  SloppyKeyboardApi,
} from './contracts';

const api: SloppyKeyboardApi = {
  typeCharacter: (character) =>
    ipcRenderer.invoke(IPC_TYPE_CHARACTER, character),
  pressSpecialKey: (key) => ipcRenderer.invoke(IPC_PRESS_SPECIAL_KEY, key),
  drawMinigame: () => ipcRenderer.invoke(IPC_DRAW_MINIGAME),
  runMinigame: (id) => ipcRenderer.invoke(IPC_RUN_MINIGAME, id),
  debugMode: () => ipcRenderer.invoke(IPC_DEBUG_MODE),
  debugRunMinigame: (id) => ipcRenderer.invoke(IPC_DEBUG_RUN_MINIGAME, id),
  closeWindow: () => ipcRenderer.send(IPC_CLOSE_WINDOW),
  minimizeWindow: () => ipcRenderer.send(IPC_MINIMIZE_WINDOW),
};

contextBridge.exposeInMainWorld('sloppyKeyboard', api);
