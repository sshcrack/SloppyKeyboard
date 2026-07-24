import {
  app,
  BrowserWindow,
  ipcMain,
} from 'electron';
import {
  IPC_CLOSE_WINDOW,
  IPC_DRAW_MINIGAME,
  IPC_DEBUG_MODE,
  IPC_DEBUG_RUN_MINIGAME,
  IPC_MINIMIZE_WINDOW,
  IPC_PRESS_SPECIAL_KEY,
  IPC_RUN_MINIGAME,
  IPC_TYPE_CHARACTER,
  MinigameResult,
  SPECIAL_KEYS,
  SpecialKey,
} from './contracts';
import { pressSpecialKey, typeCharacter } from './input-service';
import { drawMinigame, isMinigameId } from './minigame-data';
import {
  closeMinigameWindows,
  ensureDesktopGoosePath,
  runRegisteredMinigame,
} from './minigame-registry';
import {
  installHook,
  typeWithHookTemporarilyDisabled,
  uninstallHook,
} from './keyboard-hook-service';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let mainWindow: BrowserWindow | null = null;
let activeMinigame = false;
const debugMinigames = app.commandLine.hasSwitch('debug-minigames');

if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    height: 720,
    width: 960,
    minHeight: 720,
    minWidth: 960,
    maxHeight: 720,
    maxWidth: 960,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    // Pointer input still reaches a non-focusable Electron window, but it
    // leaves the previously active application as the foreground target for
    // the generated key press.
    focusable: false,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#efe3ca',
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Keep physical keystrokes inside this window while it is open. The app has
  // no keyboard controls, so preventing the event makes the keyboard inert
  // until the window is closed and focus returns to the previous application.
  mainWindow.webContents.on('before-input-event', (event) => {
    event.preventDefault();
  });

  // Only expose the taskbar button while minimized.  Keeping it hidden while
  // visible prevents the keyboard from behaving like a normal foreground app.
  mainWindow.on('minimize', () => mainWindow?.setSkipTaskbar(false));
  mainWindow.on('restore', () => mainWindow?.setSkipTaskbar(true));

  void mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  mainWindow.once('ready-to-show', () => mainWindow?.showInactive());
};

const runMinigame = async (id: unknown): Promise<MinigameResult> => {
  if (!isMinigameId(id)) {
    return { status: 'failed', message: 'UNKNOWN MINIGAME' };
  }
  if (activeMinigame || !mainWindow) {
    return { status: 'failed', message: 'A MINIGAME IS ALREADY ACTIVE' };
  }
  activeMinigame = true;
  try {
    return await runRegisteredMinigame(id, { mainWindow });
  } catch {
    return { status: 'failed', message: 'MINIGAME FAILED SAFELY' };
  } finally {
    activeMinigame = false;
  }
};

app.whenReady().then(() => {
  ipcMain.handle(IPC_TYPE_CHARACTER, (_event, character: string) =>
    typeWithHookTemporarilyDisabled(() => typeCharacter(character)),
  );
  ipcMain.handle(
    IPC_PRESS_SPECIAL_KEY,
    (_event, key: unknown) => {
      if (!SPECIAL_KEYS.includes(key as SpecialKey)) {
        return { ok: false, error: 'Unknown special key.' };
      }
      return typeWithHookTemporarilyDisabled(
        () => pressSpecialKey(key as SpecialKey),
      );
    },
  );
  ipcMain.handle(IPC_DRAW_MINIGAME, () => drawMinigame());
  ipcMain.handle(IPC_RUN_MINIGAME, (_event, id: unknown) => runMinigame(id));
  ipcMain.handle(IPC_DEBUG_MODE, () => debugMinigames);
  ipcMain.handle(IPC_DEBUG_RUN_MINIGAME, (_event, id: unknown) =>
    debugMinigames
      ? runMinigame(id)
      : Promise.resolve({
        status: 'failed' as const,
        message: 'DEBUG MINIGAMES ARE DISABLED',
      }));
  ipcMain.on(IPC_CLOSE_WINDOW, (event) =>
    BrowserWindow.fromWebContents(event.sender)?.close(),
  );
  ipcMain.on(IPC_MINIMIZE_WINDOW, (event) =>
    BrowserWindow.fromWebContents(event.sender)?.minimize(),
  );
  createWindow();
  mainWindow.once('ready-to-show', () => {
    void ensureDesktopGoosePath(mainWindow as BrowserWindow);
  });
  installHook();
});

app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => {
  closeMinigameWindows();
  uninstallHook();
});
