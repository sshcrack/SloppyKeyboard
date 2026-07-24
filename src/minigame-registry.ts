import { execFile, spawn } from 'child_process';
import {
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'fs';
import { basename, dirname, join } from 'path';
import {
  app,
  BrowserWindow,
  dialog,
  screen,
  session,
  shell,
} from 'electron';
import type {
  MinigameDescriptor,
  MinigameId,
  MinigameResult,
} from './contracts';
import {
  MINIGAMES,
  USELESS_WEBSITES,
  sampleDistinct,
} from './minigame-data';
import { openFakeBluescreen } from './fake-bluescreen';
import { secureRemoteWindow } from './remote-window';

export interface MinigameContext {
  mainWindow: BrowserWindow;
}

interface MinigameHandler {
  descriptor: MinigameDescriptor;
  run: (context: MinigameContext) => Promise<MinigameResult>;
}

const childWindows = new Set<BrowserWindow>();
const track = (window: BrowserWindow): BrowserWindow => {
  childWindows.add(window);
  window.once('closed', () => childWindows.delete(window));
  return window;
};

const openUselessWebsites = ({ mainWindow }: MinigameContext): Promise<MinigameResult> =>
  new Promise((resolve) => {
    const urls = sampleDistinct(USELESS_WEBSITES, 10);
    let remaining = urls.length;
    mainWindow.hide();
    urls.forEach((url, index) => {
      const window = track(secureRemoteWindow({
        x: 40 + index * 28,
        y: 35 + index * 24,
        width: 760,
        height: 560,
        alwaysOnTop: true,
        minimizable: false,
        title: `Useless website ${index + 1}/10`,
      }));
      window.setAlwaysOnTop(true, 'screen-saver');
      window.once('closed', () => {
        remaining -= 1;
        if (remaining === 0) {
          mainWindow.showInactive();
          resolve({ status: 'completed', message: 'USELESS WINDOWS CLEARED' });
        }
      });
      void window.loadURL(url).finally(() => {
        if (!window.isDestroyed()) window.show();
      });
    });
  });

const shortsAssetFolder = (): string => app.isPackaged
  ? join(process.resourcesPath, 'shorts')
  : join(app.getAppPath(), 'assets', 'shorts');

const shortsVideoPaths = (): string[] => {
  const folder = shortsAssetFolder();
  if (!existsSync(folder)) return [];
  return readdirSync(folder)
    .filter((file) => /\.(mp4|webm|mov|mkv)$/i.test(file))
    .map((file) => join(folder, file));
};

const shortsTimerDocument = (): string => `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;background:#050505;color:#fff;font:700 18px "Courier New",monospace;border:4px solid #ff2020;display:grid;place-items:center;height:100vh;letter-spacing:.08em;box-shadow:inset 0 0 18px #ff0000}span{color:#ff3b30;font-size:38px;text-shadow:2px 2px #700}
</style></head><body><div>SHORTS SENTENCE: <span id="remaining">30s</span></div></body></html>`;

const updateShortsTimer = (timerWindow: BrowserWindow, seconds: number): void => {
  if (!timerWindow.isDestroyed()) {
    void timerWindow.webContents.executeJavaScript(
      `document.querySelector('#remaining').textContent = '${seconds}s';`,
    ).catch((): void => undefined);
    timerWindow.setAlwaysOnTop(true, 'screen-saver');
    timerWindow.moveTop();
  }
};

const runShorts = ({ mainWindow }: MinigameContext): Promise<MinigameResult> =>
  new Promise((resolve) => {
    const videos = shortsVideoPaths();
    if (videos.length === 0 || !videos.every(existsSync)) {
      resolve({ status: 'failed', message: 'SHORTS VIDEOS ARE MISSING' });
      return;
    }
    mainWindow.minimize();
    const mainDisplay = screen.getDisplayMatching(mainWindow.getBounds());
    const blockerWindows = screen.getAllDisplays()
      .filter((display) => display.id !== mainDisplay.id)
      .map((display) => {
        const blocker = track(new BrowserWindow({
          ...display.bounds,
          frame: false,
          focusable: false,
          alwaysOnTop: true,
          skipTaskbar: true,
          show: false,
          backgroundColor: '#000000',
        }));
        blocker.setAlwaysOnTop(true, 'screen-saver');
        blocker.showInactive();
        return blocker;
      });
    const shortsSession = session.fromPartition('persist:sloppy-youtube-shorts', {
      cache: true,
    });
    shortsSession.setPermissionCheckHandler(() => false);
    shortsSession.setPermissionRequestHandler((_contents, _permission, reply) =>
      reply(false));
    const window = track(new BrowserWindow({
      ...mainDisplay.bounds,
      frame: false,
      focusable: true,
      alwaysOnTop: true,
      fullscreen: true,
      kiosk: true,
      minimizable: false,
      maximizable: false,
      autoHideMenuBar: true,
      skipTaskbar: true,
      title: 'YouTube Shorts · loading…',
      show: false,
      webPreferences: {
        sandbox: true,
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        session: shortsSession,
      },
    }));
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    const timerWindow = track(new BrowserWindow({
      x: mainDisplay.workArea.x + 24,
      y: mainDisplay.workArea.y + 24,
      width: 370,
      height: 88,
      parent: window,
      frame: false,
      focusable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    }));
    timerWindow.setAlwaysOnTop(true, 'screen-saver');
    timerWindow.once('ready-to-show', () => timerWindow.showInactive());
    void timerWindow.loadURL(`data:text/html;charset=utf-8,${
      encodeURIComponent(shortsTimerDocument())
    }`);
    const playerWidth = Math.min(360, Math.floor(mainDisplay.workArea.width / 3));
    const playerHeight = Math.min(640, mainDisplay.workArea.height - 150);
    const downloadedPlayers = videos.map((video, index) => {
      const onLeft = index % 2 === 0;
      const edgeInset = 24 + Math.floor(index / 2) * 18;
      const playerX = onLeft
        ? mainDisplay.workArea.x + edgeInset
        : mainDisplay.workArea.x + mainDisplay.workArea.width
          - playerWidth - edgeInset;
      const player = track(new BrowserWindow({
        x: playerX,
        y: mainDisplay.workArea.y + 112,
        width: playerWidth,
        height: playerHeight,
        parent: window,
        frame: false,
        focusable: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        show: false,
        backgroundColor: '#000000',
        webPreferences: {
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
        },
      }));
      player.setAlwaysOnTop(true, 'screen-saver');
      player.once('ready-to-show', () => {
        player.showInactive();
        player.moveTop();
        timerWindow.moveTop();
      });
      void player.loadFile(join(shortsAssetFolder(), 'player.html'), {
        query: {
          file: basename(video),
          number: String(index + 1),
        },
      });
      return player;
    });
    let seconds = 30;
    let loaded = false;
    let allowClose = false;
    let timer: NodeJS.Timeout | undefined;
    const finish = (result: MinigameResult): void => {
      if (timer) clearInterval(timer);
      blockerWindows.forEach((blocker) => {
        if (!blocker.isDestroyed()) blocker.destroy();
      });
      if (!timerWindow.isDestroyed()) timerWindow.destroy();
      downloadedPlayers.forEach((player) => {
        if (!player.isDestroyed()) player.destroy();
      });
      mainWindow.restore();
      mainWindow.showInactive();
      resolve(result);
    };
    window.on('close', (event) => {
      if (!allowClose && loaded) event.preventDefault();
    });
    window.on('closed', () => finish(loaded
      ? { status: 'completed', message: 'SHORTS SENTENCE COMPLETE' }
      : { status: 'failed', message: 'SHORTS FAILED TO LOAD' }));
    window.on('blur', () => {
      if (!allowClose && loaded && !window.isDestroyed()) {
        window.show();
        window.focus();
      }
    });
    window.webContents.once('did-fail-load', () => {
      allowClose = true;
      window.close();
    });
    window.webContents.once('did-finish-load', () => {
      loaded = true;
      window.setAlwaysOnTop(true, 'screen-saver');
      window.show();
      window.focus();
      downloadedPlayers.forEach((player) => {
        player.showInactive();
        player.moveTop();
      });
      timerWindow.showInactive();
      timerWindow.moveTop();
      window.setTitle(`YouTube Shorts · ${seconds}s remaining`);
      updateShortsTimer(timerWindow, seconds);
      timer = setInterval(() => {
        seconds -= 1;
        window.setTitle(`YouTube Shorts · ${seconds}s remaining`);
        updateShortsTimer(timerWindow, seconds);
        if (seconds <= 0) {
          allowClose = true;
          window.close();
        }
      }, 1000);
    });
    void window.loadURL('https://www.youtube.com/shorts');
  });

const gooseConfigPath = (): string =>
  join(app.getPath('userData'), 'desktop-goose.json');

const readGoosePath = (): string | null => {
  try {
    const value = JSON.parse(readFileSync(gooseConfigPath(), 'utf8'));
    return typeof value.executablePath === 'string' ? value.executablePath : null;
  } catch {
    return null;
  }
};

const chooseGoosePath = async (
  mainWindow: BrowserWindow,
): Promise<string | null> => {
  for (;;) {
    const choice = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      title: 'Desktop Goose setup',
      message: 'Desktop Goose is not bundled because its license forbids redistribution.',
      detail: 'Download it from the official page, select GooseDesktop.exe, or cancel.',
      buttons: ['Open official download', 'Select GooseDesktop.exe', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
    });
    if (choice.response === 0) {
      await shell.openExternal('https://samperson.itch.io/desktop-goose?download');
      continue;
    }
    if (choice.response !== 1) return null;
    const selected = await dialog.showOpenDialog(mainWindow, {
      title: 'Select GooseDesktop.exe',
      properties: ['openFile'],
      filters: [{ name: 'Windows executable', extensions: ['exe'] }],
    });
    const executablePath = selected.filePaths[0];
    if (selected.canceled || !executablePath) continue;
    writeFileSync(gooseConfigPath(), JSON.stringify({ executablePath }), 'utf8');
    return executablePath;
  }
};

/** Prompts during app startup so the minigame can launch without setup UI. */
export const ensureDesktopGoosePath = async (
  mainWindow: BrowserWindow,
): Promise<void> => {
  const executablePath = readGoosePath();
  if (!executablePath || !existsSync(executablePath)) {
    await chooseGoosePath(mainWindow);
  }
};

const runGoose = async (): Promise<MinigameResult> => {
  const executablePath = readGoosePath();
  if (!executablePath || !existsSync(executablePath)) {
    return { status: 'cancelled', message: 'DESKTOP GOOSE SETUP INCOMPLETE' };
  }
  try {
    spawn(executablePath, [], {
      cwd: dirname(executablePath),
      detached: true,
      shell: false,
      stdio: 'ignore',
    }).unref();
    return { status: 'completed', message: 'GOOSE RELEASED' };
  } catch {
    return { status: 'failed', message: 'GOOSE COULD NOT BE LAUNCHED' };
  }
};

const shutDownLaptop = (): void => {
  execFile('shutdown.exe', ['/s', '/t', '0'], () => undefined);
};

const descriptors = new Map(MINIGAMES.map((game) => [game.id, game]));
const descriptor = (id: MinigameId): MinigameDescriptor => {
  const game = descriptors.get(id);
  if (!game) throw new Error(`Missing minigame descriptor: ${id}`);
  return game;
};
const registry = new Map<MinigameId, MinigameHandler>([
  ['useless-websites', {
    descriptor: descriptor('useless-websites'),
    run: openUselessWebsites,
  }],
  ['youtube-shorts', {
    descriptor: descriptor('youtube-shorts'),
    run: runShorts,
  }],
  ['desktop-goose', {
    descriptor: descriptor('desktop-goose'),
    run: runGoose,
  }],
  ['bluescreen', {
    descriptor: descriptor('bluescreen'),
    run: async () => {
      await openFakeBluescreen(track, shutDownLaptop);
      return { status: 'completed', message: 'RECOVERY COMPLETE' };
    },
  }],
]);

export const runRegisteredMinigame = async (
  id: MinigameId,
  context: MinigameContext,
): Promise<MinigameResult> => {
  const handler = registry.get(id);
  if (!handler) return { status: 'failed', message: 'UNKNOWN MINIGAME' };
  return handler.run(context);
};

export const closeMinigameWindows = (): void => {
  for (const window of childWindows) {
    if (!window.isDestroyed()) window.destroy();
  }
  childWindows.clear();
};
