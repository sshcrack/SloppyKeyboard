import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { dirname, join } from 'path';

export interface GooseInstallResult {
  changed: boolean;
  restartRequired: boolean;
  targetDll: string;
}

// Goose v0.31 IL immediately preceding the "Mod Enabler Warning" MessageBox.
// `br.s 0x1F` jumps directly to the existing mod-initialization call before the
// configuration value is loaded, so the method's IL evaluation stack remains
// valid. Keep both signatures to make this safe and idempotent.
const MOD_WARNING_UNPATCHED = Buffer.from([
  0x7E, 0x06, 0x00, 0x00, 0x04, 0x7B, 0xAC, 0x00, 0x00, 0x04, 0x2C, 0x1A,
  0x72, 0xEF, 0x09, 0x00, 0x70, 0x72, 0x0A, 0x0C, 0x00, 0x70,
]);
const MOD_WARNING_PATCHED = Buffer.from([
  0x2B, 0x1F, 0x00, 0x00, 0x00, 0x7B, 0xAC, 0x00, 0x00, 0x04, 0x2C, 0x1A,
  0x72, 0xEF, 0x09, 0x00, 0x70, 0x72, 0x0A, 0x0C, 0x00, 0x70,
]);

/** Returns true only when a known unpatched Goose v0.31 executable was changed. */
export const disableGooseModWarning = (executablePath: string): boolean => {
  const executable = readFileSync(executablePath);
  if (executable.indexOf(MOD_WARNING_PATCHED) !== -1) return false;

  const offset = executable.indexOf(MOD_WARNING_UNPATCHED);
  if (offset === -1) return false;
  if (executable.indexOf(MOD_WARNING_UNPATCHED, offset + 1) !== -1) {
    throw new Error('Desktop Goose contains multiple Mod Enabler Warning patch locations');
  }

  const backupPath = `${executablePath}.pre-mod-warning-patch.bak`;
  if (!existsSync(backupPath)) copyFileSync(executablePath, backupPath);
  MOD_WARNING_PATCHED.copy(executable, offset);
  writeFileSync(executablePath, executable);
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
  const autumnModFolder = join(root, 'Assets', 'Mods', 'Autumn');
  if (!existsSync(sourceDll)) throw new Error(`Integration DLL is missing: ${sourceDll}`);
  if (!existsSync(configPath)) throw new Error(`Desktop Goose config is missing: ${configPath}`);
  try {
    const original = readFileSync(configPath, 'utf8');
    if (!existsSync(backupPath)) writeFileSync(backupPath, original, 'utf8');
    const configured = enableMods(original);
    if (configured !== original) writeFileSync(configPath, configured, 'utf8');
    const warningPatched = disableGooseModWarning(executablePath);
    // Desktop Goose ships with this optional seasonal mod. It is not part of
    // Sloppy Keyboard, so remove the bundled copy during automatic setup.
    const autumnRemoved = existsSync(autumnModFolder);
    if (autumnRemoved) rmSync(autumnModFolder, { recursive: true, force: true });
    mkdirSync(targetFolder, { recursive: true });
    const dllChanged = !existsSync(targetDll)
      || statSync(sourceDll).size !== statSync(targetDll).size
      || !readFileSync(sourceDll).equals(readFileSync(targetDll));
    if (dllChanged) copyFileSync(sourceDll, targetDll);
    return {
      changed: configured !== original || warningPatched || autumnRemoved || dllChanged,
      restartRequired: gooseRunning && (warningPatched || autumnRemoved || dllChanged),
      targetDll,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not configure Desktop Goose at ${root}: ${detail}. Run Sloppy Keyboard elevated or correct this path manually.`);
  }
};
