import { BrowserWindow, session } from 'electron';

export const secureRemoteWindow = (
  options: Electron.BrowserWindowConstructorOptions = {},
): BrowserWindow => {
  const partition = `temp:sloppy-${Date.now()}-${Math.random()}`;
  const isolatedSession = session.fromPartition(partition, { cache: false });
  isolatedSession.setPermissionCheckHandler(() => false);
  isolatedSession.setPermissionRequestHandler((_contents, _permission, reply) =>
    reply(false));
  isolatedSession.on('will-download', (event) => event.preventDefault());

  const window = new BrowserWindow({
    width: 900,
    height: 680,
    show: false,
    ...options,
    webPreferences: {
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      session: isolatedSession,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!/^https?:\/\//i.test(url)) event.preventDefault();
  });
  return window;
};
