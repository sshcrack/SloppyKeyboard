import type { SloppyKeyboardApi } from './contracts';

declare global {
  interface Window {
    sloppyKeyboard: SloppyKeyboardApi;
  }
}

export {};
