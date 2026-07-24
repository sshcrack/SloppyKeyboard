import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CLOSE_WINDOW,
  IPC_DRAW_MINIGAME,
  IPC_DEBUG_MODE,
  IPC_DEBUG_RUN_MINIGAME,
  IPC_DEBUG_RUN_SURPRISE,
  IPC_MINIMIZE_WINDOW,
  IPC_PRESS_SPECIAL_KEY,
  IPC_RUN_MINIGAME,
  IPC_TYPE_CHARACTER,
  IPC_GOOSE_STATE,
  IPC_GOOSE_BALLS,
  IPC_ESCAPE_BALL,
  IPC_CUP_PICK,
  IPC_DESKTOP_EFFECT,
  IPC_GOOSE_SETUP_PROGRESS,
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
  debugRunSurprise: (surprise) => ipcRenderer.invoke(IPC_DEBUG_RUN_SURPRISE, surprise),
  closeWindow: () => ipcRenderer.send(IPC_CLOSE_WINDOW),
  minimizeWindow: () => ipcRenderer.send(IPC_MINIMIZE_WINDOW),
  sendGooseBalls: (balls, boardBounds, mysterySlot) =>
    ipcRenderer.send(IPC_GOOSE_BALLS, { balls, boardBounds, mysterySlot }),
  escapeBall: (ball) => ipcRenderer.send(IPC_ESCAPE_BALL, ball),
  selectCup: (cup) => ipcRenderer.send(IPC_CUP_PICK, cup),
  onGooseState: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, state: Parameters<typeof listener>[0]): void => listener(state);
    ipcRenderer.on(IPC_GOOSE_STATE, handler);
    return () => ipcRenderer.removeListener(IPC_GOOSE_STATE, handler);
  },
  onEscapedBall: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, ball: Parameters<typeof listener>[0]): void => listener(ball);
    ipcRenderer.on(IPC_ESCAPE_BALL, handler);
    return () => ipcRenderer.removeListener(IPC_ESCAPE_BALL, handler);
  },
  onDesktopEffect: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, effect: Parameters<typeof listener>[0]): void => listener(effect);
    ipcRenderer.on(IPC_DESKTOP_EFFECT, handler);
    return () => ipcRenderer.removeListener(IPC_DESKTOP_EFFECT, handler);
  },
  onGooseSetupProgress: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: Parameters<typeof listener>[0]): void => listener(progress);
    ipcRenderer.on(IPC_GOOSE_SETUP_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC_GOOSE_SETUP_PROGRESS, handler);
  },
};

contextBridge.exposeInMainWorld('sloppyKeyboard', api);
