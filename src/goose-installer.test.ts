import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { installGooseMod, restoreGooseExecutable } from './goose-installer';

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

  it('restores executables damaged by the retired warning patch', () => {
    const root = mkdtempSync(join(tmpdir(), 'sloppy-goose-'));
    const exe = join(root, 'GooseDesktop.exe');
    const original = Buffer.from([
      0x10, 0x7E, 0x06, 0x00, 0x00, 0x04, 0x7B, 0xAC, 0x00, 0x00, 0x04, 0x2C, 0x1A,
      0x72, 0xEF, 0x09, 0x00, 0x70, 0x72, 0x0A, 0x0C, 0x00, 0x70, 0x20,
    ]);
    const patched = Buffer.from([
      0x10, 0x2B, 0x1F, 0x00, 0x00, 0x00, 0x7B, 0xAC, 0x00, 0x00, 0x04, 0x2C, 0x1A,
      0x72, 0xEF, 0x09, 0x00, 0x70, 0x72, 0x0A, 0x0C, 0x00, 0x70, 0x20,
    ]);
    writeFileSync(exe, patched);
    writeFileSync(`${exe}.pre-mod-warning-patch.bak`, original);
    expect(restoreGooseExecutable(exe)).toBe(true);
    expect(readFileSync(exe)).toEqual(original);
    expect(restoreGooseExecutable(exe)).toBe(false);
  });
});
