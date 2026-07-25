import {
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  powerMonitor,
  screen,
} from 'electron';
import { join } from 'path';
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
  BallSnapshot,
  ScreenRect,
  MinigameResult,
  DesktopEffect,
  IPC_DESKTOP_EFFECT,
  SPECIAL_KEYS,
  SpecialKey,
  DEBUG_SURPRISES,
  DebugSurprise,
} from './contracts';
import { pressSpecialKey, typeCharacter } from './input-service';
import { drawMinigame, isMinigameId } from './minigame-data';
import {
  closeMinigameWindows,
  closeDesktopGoose,
  ensureDesktopGoosePath,
  runRegisteredMinigame,
} from './minigame-registry';
import {
  installHook,
  typeWithHookTemporarilyDisabled,
  uninstallHook,
} from './keyboard-hook-service';
import { GooseBridge } from './goose-bridge';
import { SurpriseScheduler, omenDelayMs } from './surprise-scheduler';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const DESKTOP_OVERLAY_WEBPACK_ENTRY: string;
declare const DESKTOP_OVERLAY_PRELOAD_WEBPACK_ENTRY: string;

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let shutdownStarted = false;
const ballSources = new Map<number, BallSnapshot[]>();
let latestBoardBounds: ScreenRect = { x: 0, y: 0, width: 880, height: 560 };
let latestMysterySlot: ScreenRect | null = null;
const gooseBridge = new GooseBridge((state) => {
  for (const window of [mainWindow, overlayWindow]) {
    if (window && !window.isDestroyed()) window.webContents.send(IPC_GOOSE_STATE, state);
  }
});
let activeMinigame = false;
const surprises = new SurpriseScheduler();
let omenUsed = false;
let omenTimer: NodeJS.Timeout | undefined;
let naturalTimer: NodeJS.Timeout | undefined;
const debugMinigames = app.commandLine.hasSwitch('debug-minigames');
const keyboardBlockerEnabled = !app.commandLine.hasSwitch('disable-keyboard-blocker');
const appIconPath = join(
  app.getAppPath(),
  'assets',
  'icon',
  'sloppy-keyboard.ico',
);

const shutDown = (): void => {
  if (shutdownStarted) return;
  shutdownStarted = true;
  gooseBridge.stop();
  closeMinigameWindows();
  closeDesktopGoose();
  uninstallHook();
  if (omenTimer) clearTimeout(omenTimer);
  if (naturalTimer) clearInterval(naturalTimer);
};

if (require('electron-squirrel-startup')) {
  app.quit();
}

// Surprise sounds are always capped inside the renderer and never modify the
// user's system volume. Allow timer-driven effects to play those local clips.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.setAppUserModelId('com.squirrel.SloppyKeyboard.SloppyKeyboard');

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
    icon: appIconPath,
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
  // Start external cleanup before Electron begins its final quit sequence. In
  // particular, Desktop Goose's own Close Goose.bat gets time to terminate
  // the extra windows/processes it creates.
  mainWindow.once('close', shutDown);
  // The desktop-ball overlay is a separate invisible window, so it would keep
  // Electron alive after the keyboard closes unless the main window explicitly
  // ends the application.
  mainWindow.once('closed', () => {
    mainWindow = null;
    app.quit();
  });

  void mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  mainWindow.once('ready-to-show', () => mainWindow?.showInactive());
};

const createOverlay = (): BrowserWindow => {
  if (overlayWindow && !overlayWindow.isDestroyed()) return overlayWindow;
  const displays = screen.getAllDisplays();
  const left = Math.min(...displays.map((display) => display.bounds.x));
  const top = Math.min(...displays.map((display) => display.bounds.y));
  const right = Math.max(...displays.map((display) => display.bounds.x + display.bounds.width));
  const bottom = Math.max(...displays.map((display) => display.bounds.y + display.bounds.height));
  overlayWindow = new BrowserWindow({
    x: left, y: top, width: right - left, height: bottom - top,
    frame: false, transparent: true, backgroundColor: '#00000000',
    focusable: false, skipTaskbar: true, alwaysOnTop: true, hasShadow: false,
    webPreferences: {
      preload: DESKTOP_OVERLAY_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  overlayWindow.setIgnoreMouseEvents(true);
  overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  void overlayWindow.loadURL(DESKTOP_OVERLAY_WEBPACK_ENTRY);
  return overlayWindow;
};

const desktopEffect = (effect: DesktopEffect): void => {
  const overlay = createOverlay();
  overlay.setAlwaysOnTop(true, 'screen-saver', 1);
  overlay.moveTop();
  const send = async (): Promise<void> => {
    let payload = effect;
    if (effect.kind === 'fracture' && !effect.snapshot) {
      const display = screen.getDisplayNearestPoint({ x: effect.x, y: effect.y });
      try {
        const sources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: { width: effect.area.width, height: effect.area.height },
          fetchWindowIcons: false,
        });
        const source = sources.find(({ display_id: id }) => id === String(display.id))
          ?? sources[0];
        if (source) payload = { ...effect, snapshot: source.thumbnail.toDataURL() };
      } catch {
        // The modeled glass layer still runs if screen capture is unavailable.
      }
    }
    if (!overlay.isDestroyed()) {
      overlay.setAlwaysOnTop(true, 'screen-saver', 1);
      overlay.moveTop();
      overlay.webContents.send(IPC_DESKTOP_EFFECT, payload);
    }
  };
  if (overlay.webContents.isLoading()) overlay.webContents.once('did-finish-load', send);
  else void send();
};

const scheduleOmen = (): void => {
  if (omenUsed || omenTimer) return;
  omenTimer = setTimeout(() => {
    omenTimer = undefined;
    if (activeMinigame || !surprises.begin('omen')) { scheduleOmen(); return; }
    omenUsed = true;
    desktopEffect({ kind: 'omen-title' });
    setTimeout(() => {
      const point = screen.getCursorScreenPoint();
      const display = screen.getDisplayNearestPoint(point);
      const leftDistance = point.x - display.workArea.x;
      const rightDistance = display.workArea.x + display.workArea.width - point.x;
      desktopEffect({ kind: 'eyes', x: point.x, y: point.y, side: leftDistance <= rightDistance ? 'left' : 'right' });
      setTimeout(() => surprises.end('omen'), 3_400);
    }, 1600);
  }, omenDelayMs());
};

const runMinigame = async (id: unknown): Promise<MinigameResult> => {
  if (!isMinigameId(id)) {
    return { status: 'failed', message: 'UNKNOWN MINIGAME' };
  }
  if (activeMinigame || !mainWindow) {
    return { status: 'failed', message: 'A MINIGAME IS ALREADY ACTIVE' };
  }
  activeMinigame = true;
  surprises.begin('minigame');
  try {
    const result = await runRegisteredMinigame(id, {
      mainWindow, desktopEffect,
    });
    if (result.status === 'completed' && !omenUsed && Math.random() < 0.05) scheduleOmen();
    return result;
  } catch {
    return { status: 'failed', message: 'MINIGAME FAILED SAFELY' };
  } finally {
    activeMinigame = false;
    surprises.end('minigame');
  }
};

app.whenReady().then(() => {
  gooseBridge.start();
  powerMonitor.on('suspend', () => { gooseBridge.setSuspended(true); surprises.setAwake(false); });
  powerMonitor.on('resume', () => { gooseBridge.setSuspended(false); surprises.setAwake(true); });
  ipcMain.handle(IPC_TYPE_CHARACTER, (_event, character: string) =>
    keyboardBlockerEnabled
      ? typeWithHookTemporarilyDisabled(() => typeCharacter(character))
      : typeCharacter(character),
  );
  ipcMain.handle(
    IPC_PRESS_SPECIAL_KEY,
    (_event, key: unknown) => {
      if (!SPECIAL_KEYS.includes(key as SpecialKey)) {
        return { ok: false, error: 'Unknown special key.' };
      }
      const pressKey = () => pressSpecialKey(key as SpecialKey);
      return keyboardBlockerEnabled
        ? typeWithHookTemporarilyDisabled(pressKey)
        : pressKey();
    },
  );
  ipcMain.handle(IPC_DRAW_MINIGAME, () => drawMinigame());
  ipcMain.handle(IPC_RUN_MINIGAME, (_event, id: unknown) => runMinigame(id));
  ipcMain.handle(IPC_DEBUG_MODE, () => debugMinigames);
  ipcMain.on(IPC_GOOSE_BALLS, (event, payload: {
    balls: BallSnapshot[]; boardBounds: ScreenRect; mysterySlot: ScreenRect | null;
  }) => {
    if (!payload || !Array.isArray(payload.balls)) return;
    ballSources.set(event.sender.id, payload.balls);
    if (payload.mysterySlot) {
      latestBoardBounds = payload.boardBounds;
      latestMysterySlot = payload.mysterySlot;
    }
    gooseBridge.sendBalls([...ballSources.values()].flat(), latestBoardBounds, latestMysterySlot);
  });
  ipcMain.on(IPC_ESCAPE_BALL, (_event, ball: BallSnapshot) => {
    if (!ball || typeof ball.x !== 'number' || typeof ball.y !== 'number') return;
    const display = screen.getDisplayNearestPoint({ x: Math.round(ball.x), y: Math.round(ball.y) });
    const overlay = createOverlay();
    const send = (): void => overlay.webContents.send(IPC_ESCAPE_BALL, { ball, workArea: display.workArea });
    if (overlay.webContents.isLoading()) overlay.webContents.once('did-finish-load', send);
    else send();
  });
  ipcMain.handle(IPC_DEBUG_RUN_MINIGAME, (_event, id: unknown) =>
    debugMinigames
      ? runMinigame(id)
      : Promise.resolve({
        status: 'failed' as const,
        message: 'DEBUG MINIGAMES ARE DISABLED',
      }));
  ipcMain.handle(IPC_DEBUG_RUN_SURPRISE, (_event, raw: unknown): MinigameResult => {
    if (!debugMinigames || !DEBUG_SURPRISES.includes(raw as DebugSurprise)) {
      return { status: 'failed', message: 'DEBUG SURPRISES ARE DISABLED' };
    }
    const point = screen.getCursorScreenPoint();
    const surprise = raw as DebugSurprise;
    if (surprise === 'fallen-balls') desktopEffect({ kind: 'balls', x: point.x, y: point.y, count: 15 });
    else if (surprise === 'fracture') {
      const area = screen.getDisplayNearestPoint(point).bounds;
      desktopEffect({ kind: 'fracture', x: point.x, y: point.y, area });
    }
    else if (surprise === 'cameo') desktopEffect({ kind: 'cameo', x: point.x, y: point.y });
    else if (surprise === 'pixel-goose') desktopEffect({ kind: 'cursor-goose', x: point.x, y: point.y });
    else if (surprise === 'steve-dig') {
      const display = screen.getDisplayNearestPoint(point);
      desktopEffect({
        kind: 'steve-dig', x: point.x, y: point.y,
        area: display.bounds, workArea: display.workArea,
      });
    }
    else if (surprise === 'omen-title') desktopEffect({ kind: 'omen-title' });
    else {
      const display = screen.getDisplayNearestPoint(point);
      desktopEffect({ kind: 'eyes', x: point.x, y: point.y,
        side: point.x - display.workArea.x < display.workArea.x + display.workArea.width - point.x ? 'left' : 'right' });
    }
    return { status: 'completed', message: `DEBUG ${surprise.toUpperCase()} COMPLETE` };
  });
  ipcMain.on(IPC_CLOSE_WINDOW, (event) =>
    BrowserWindow.fromWebContents(event.sender)?.close(),
  );
  ipcMain.on(IPC_MINIMIZE_WINDOW, (event) =>
    BrowserWindow.fromWebContents(event.sender)?.minimize(),
  );
  createWindow();
  surprises.scheduleNatural(Date.now());
  naturalTimer = setInterval(() => {
    if (!surprises.takeNatural(Date.now()) || !surprises.begin('steve-dig')) return;
    const cursor = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursor);
    desktopEffect({
      kind: 'steve-dig',
      x: display.workArea.x + 180 + Math.random() * Math.max(1, display.workArea.width - 360),
      y: display.workArea.y + 180 + Math.random() * Math.max(1, display.workArea.height - 360),
      area: display.bounds,
      workArea: display.workArea,
    });
    setTimeout(() => surprises.end('steve-dig'), 13_600);
  }, 1000);
  mainWindow.once('ready-to-show', () => {
    void ensureDesktopGoosePath(mainWindow as BrowserWindow);
  });
  if (keyboardBlockerEnabled) installHook();
});

app.on('window-all-closed', () => app.quit());
app.on('will-quit', shutDown);
