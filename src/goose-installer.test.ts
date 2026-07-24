import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { installGooseMod } from './goose-installer';

describe('Goose mod installation', () => {
  it('preserves settings, makes one backup, and upgrades the DLL', () => {
    const root = mkdtempSync(join(tmpdir(), 'sloppy-goose-'));
    const exe = join(root, 'GooseDesktop.exe');
    const dll = join(root, 'source.dll');
    writeFileSync(exe, '');
    writeFileSync(join(root, 'config.ini'), 'Volume=20\r\nEnableMods=False\r\n');
    writeFileSync(dll, 'v1');
    const first = installGooseMod(exe, dll);
    expect(first.changed).toBe(true);
    expect(readFileSync(join(root, 'config.ini'), 'utf8')).toContain('Volume=20\r\nEnableMods=True');
    const backup = readFileSync(join(root, 'config.ini.sloppy-keyboard.bak'), 'utf8');
    expect(backup).toContain('EnableMods=False');
    expect(installGooseMod(exe, dll).changed).toBe(false);
    writeFileSync(dll, 'version two');
    expect(installGooseMod(exe, dll, true).restartRequired).toBe(true);
    expect(readFileSync(join(root, 'config.ini.sloppy-keyboard.bak'), 'utf8')).toBe(backup);
  });

  it('creates the nested mod directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'sloppy-goose-'));
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, 'GooseDesktop.exe'), '');
    writeFileSync(join(root, 'config.ini'), 'Volume=10');
    writeFileSync(join(root, 'source.dll'), 'dll');
    expect(installGooseMod(join(root, 'GooseDesktop.exe'), join(root, 'source.dll')).targetDll)
      .toContain(join('Assets', 'Mods', 'SloppyKeyboard'));
  });
});
