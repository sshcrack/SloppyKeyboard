import extract from 'extract-zip';
import { mkdirSync, readdirSync, statSync } from 'fs';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import type { GooseSetupProgress } from './contracts';

const ARCHIVE_URL = 'https://github.com/NguyAnhQuan/DesktopGoose/archive/refs/heads/main.zip';

const findExecutable = (folder: string): string | null => {
  for (const name of readdirSync(folder)) {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) {
      const nested = findExecutable(path);
      if (nested) return nested;
    } else if (name.toLowerCase() === 'goosedesktop.exe') return path;
  }
  return null;
};

export const downloadDesktopGoose = async (
  userData: string,
  progress: (state: GooseSetupProgress) => void,
): Promise<string> => {
  const archive = join(userData, 'desktop-goose-download.zip');
  const destination = join(userData, 'desktop-goose');
  mkdirSync(destination, { recursive: true });
  progress({ phase: 'download', percent: 2, detail: 'CONTACTING GITHUB...' });
  const response = await fetch(ARCHIVE_URL, { redirect: 'follow' });
  if (!response.ok || !response.body) throw new Error(`GitHub download failed (${response.status})`);
  const total = Number(response.headers.get('content-length')) || 0;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const result = await reader.read();
    if (result.done) break;
    chunks.push(result.value);
    received += result.value.byteLength;
    const percent = total ? 5 + received / total * 65 : Math.min(68, 5 + chunks.length);
    progress({ phase: 'download', percent, detail: `DOWNLOADING ARCHIVE · ${(received / 1048576).toFixed(1)} MB` });
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  await writeFile(archive, bytes);
  progress({ phase: 'extract', percent: 74, detail: 'UNPACKING DESKTOP GOOSE...' });
  await extract(archive, { dir: destination });
  await unlink(archive).catch((): void => undefined);
  const executable = findExecutable(destination);
  if (!executable) throw new Error('The downloaded archive did not contain GooseDesktop.exe');
  progress({ phase: 'configure', percent: 92, detail: 'INSTALLING SLOPPY KEYBOARD MOD...' });
  return executable;
};
