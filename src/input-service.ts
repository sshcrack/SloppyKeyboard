import { Key, keyboard } from '@nut-tree-fork/nut-js';
import type { SpecialKey, TypeResult } from './contracts';

let typingQueue: Promise<unknown> = Promise.resolve();

// Keep generated key events far enough apart for the foreground application
// and the low-level blocker hand-off to process them reliably.
keyboard.config.autoDelayMs = 35;

export const typeCharacter = (character: string): Promise<TypeResult> => {
  if (!/^[a-z]$/.test(character)) {
    return Promise.resolve({
      ok: false,
      error: 'Only one lowercase letter is allowed.',
    });
  }

  const task = typingQueue.then(() => keyboard.type(character));
  typingQueue = task.catch((): void => undefined);
  return task
    .then(() => ({ ok: true }))
    .catch((error: unknown) => ({
      ok: false,
      error: error instanceof Error
        ? error.message
        : 'Windows rejected the key press.',
    }));
};

const NATIVE_SPECIAL_KEYS: Record<SpecialKey, Key> = {
  backspace: Key.Backspace,
  enter: Key.Enter,
};

export const pressSpecialKey = (key: SpecialKey): Promise<TypeResult> => {
  const nativeKey = NATIVE_SPECIAL_KEYS[key];
  if (nativeKey === undefined) {
    return Promise.resolve({ ok: false, error: 'Unknown special key.' });
  }

  const task = typingQueue.then(() => keyboard.type(nativeKey));
  typingQueue = task.catch((): void => undefined);
  return task
    .then(() => ({ ok: true }))
    .catch((error: unknown) => ({
      ok: false,
      error: error instanceof Error
        ? error.message
        : 'Windows rejected the special key.',
    }));
};
