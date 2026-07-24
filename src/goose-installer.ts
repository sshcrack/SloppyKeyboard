import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'fs';
import { dirname, join } from 'path';

export interface GooseInstallResult {
  changed: boolean;
  restartRequired: boolean;
  targetDll: string;
}

const MOD_WARNING_PATCHED = Buffer.from([
  0x2B, 0x1F, 0x00, 0x00, 0x00, 0x7B, 0xAC, 0x00, 0x00, 0x04, 0x2C, 0x1A,
  0x72, 0xEF, 0x09, 0x00, 0x70, 0x72, 0x0A, 0x0C, 0x00, 0x70,
]);

/** Repairs executables modified by the retired warning-suppression patch. */
export const restoreGooseExecutable = (executablePath: string): boolean => {
  const executable = readFileSync(executablePath);
  const backupPath = `${executablePath}.pre-mod-warning-patch.bak`;
  if (executable.indexOf(MOD_WARNING_PATCHED) === -1 || !existsSync(backupPath)) {
    return false;
  }
  copyFileSync(backupPath, executablePath);
  return true;
};

const enableMods = (contents: string): string => {
  const lineEnding = contents.includes('\r\n') ? '\r\n' : '\n';
  if (/^\s*EnableMods\s*=/im.test(contents)) {
    return contents.replace(
      /^[ \t]*EnableMods[ \t]*=[^\r\n]*(\r?)$/im,
      'EnableMods=True$1',
    );
  }
  return `${contents}${contents.endsWith('\n') ? '' : lineEnding}EnableMods=True${lineEnding}`;
};

export const installGooseMod = (
  executablePath: string,
  sourceDll: string,
  gooseRunning = false,
): GooseInstallResult => {
  const root = dirname(executablePath);
  const configPath = join(root, 'config.ini');
  const backupPath = `${configPath}.sloppy-keyboard.bak`;
  const targetFolder = join(root, 'Assets', 'Mods', 'SloppyKeyboard');
  const targetDll = join(targetFolder, 'SloppyKeyboard.dll');
  if (!existsSync(sourceDll)) throw new Error(`Integration DLL is missing: ${sourceDll}`);
  if (!existsSync(configPath)) throw new Error(`Desktop Goose config is missing: ${configPath}`);
  try {
    const original = readFileSync(configPath, 'utf8');
    if (!existsSync(backupPath)) writeFileSync(backupPath, original, 'utf8');
    const configured = enableMods(original);
    if (configured !== original) writeFileSync(configPath, configured, 'utf8');
    const executableRestored = restoreGooseExecutable(executablePath);
    mkdirSync(targetFolder, { recursive: true });
    const dllChanged = !existsSync(targetDll)
      || statSync(sourceDll).size !== statSync(targetDll).size
      || !readFileSync(sourceDll).equals(readFileSync(targetDll));
    if (dllChanged) copyFileSync(sourceDll, targetDll);
    return {
      changed: configured !== original || executableRestored || dllChanged,
      restartRequired: gooseRunning && (executableRestored || dllChanged),
      targetDll,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not configure Desktop Goose at ${root}: ${detail}. Run Sloppy Keyboard elevated or correct this path manually.`);
  }
};
