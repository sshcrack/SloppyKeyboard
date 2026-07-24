export const IPC_TYPE_CHARACTER = 'sloppy-keyboard:type-character';
export const IPC_CLOSE_WINDOW = 'sloppy-keyboard:close-window';
export const IPC_MINIMIZE_WINDOW = 'sloppy-keyboard:minimize-window';
export const IPC_DRAW_MINIGAME = 'sloppy-keyboard:draw-minigame';
export const IPC_RUN_MINIGAME = 'sloppy-keyboard:run-minigame';
export const IPC_DEBUG_MODE = 'sloppy-keyboard:debug-mode';
export const IPC_DEBUG_RUN_MINIGAME = 'sloppy-keyboard:debug-run-minigame';
export const IPC_DEBUG_RUN_SURPRISE = 'sloppy-keyboard:debug-run-surprise';
export const IPC_PRESS_SPECIAL_KEY = 'sloppy-keyboard:press-special-key';
export const IPC_GOOSE_STATE = 'sloppy-keyboard:goose-state';
export const IPC_GOOSE_BALLS = 'sloppy-keyboard:goose-balls';
export const IPC_ESCAPE_BALL = 'sloppy-keyboard:escape-ball';
export const IPC_GOOSE_SETUP_PROGRESS = 'sloppy-keyboard:goose-setup-progress';
export const IPC_CUP_PICK = 'sloppy-keyboard:cup-pick';
export const IPC_DESKTOP_EFFECT = 'sloppy-keyboard:desktop-effect';

export const SPECIAL_KEYS = ['backspace', 'enter'] as const;
export type SpecialKey = typeof SPECIAL_KEYS[number];

export const MINIGAME_IDS = [
  'useless-websites',
  'youtube-shorts',
  'desktop-goose',
  'bluescreen',
  'cup-shuffle',
] as const;

export type MinigameId = typeof MINIGAME_IDS[number];

export interface MinigameDescriptor {
  id: MinigameId;
  label: string;
  description: string;
  accent: string;
}

export interface MinigameResult {
  status: 'completed' | 'cancelled' | 'failed';
  message?: string;
}

export interface MinigameDraw {
  winner: MinigameDescriptor;
  reel: MinigameDescriptor[];
}
export type DesktopEffect =
  | { kind: 'balls'; x: number; y: number; count?: number }
  | { kind: 'fracture'; x: number; y: number; area: ScreenRect }
  | { kind: 'cameo'; x: number; y: number }
  | { kind: 'cursor-goose'; x: number; y: number }
  | { kind: 'steve-dig'; x: number; y: number; area: ScreenRect }
  | { kind: 'omen-title' }
  | { kind: 'eyes'; x: number; y: number; side: 'left' | 'right' };
export const DEBUG_SURPRISES = [
  'fallen-balls', 'fracture', 'cameo', 'pixel-goose', 'steve-dig', 'omen-title', 'eyes',
] as const;
export type DebugSurprise = typeof DEBUG_SURPRISES[number];

export interface TypeResult {
  ok: boolean;
  error?: string;
}

export const GOOSE_PROTOCOL_VERSION = 1;
export interface ScreenRect { x: number; y: number; width: number; height: number }
export interface BallSnapshot {
  id: string; x: number; y: number; radius: number;
  velocityX: number; velocityY: number; space: 'screen'; huntEligible: boolean;
}
export interface GooseCircleCollider {
  id: string; kind: 'circle'; x: number; y: number; radius: number;
  velocityX: number; velocityY: number;
}
export interface GooseWindowCollider {
  id: string; kind: 'window'; bounds: ScreenRect;
  velocityX: number; velocityY: number;
}
export type GooseCollider = GooseCircleCollider | GooseWindowCollider;
export interface GooseCarry {
  ballId: string;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  released: boolean;
}
export interface GooseSpawnRequest {
  id: string;
  x: number;
}
export interface GooseState {
  protocolVersion: typeof GOOSE_PROTOCOL_VERSION;
  connected: boolean; receivedAt: number; colliders: GooseCollider[];
  carries: GooseCarry[];
  spawnRequests: GooseSpawnRequest[];
  error?: string;
}
export interface EscapedBall { ball: BallSnapshot; workArea: ScreenRect }
export interface GooseSetupProgress {
  phase: 'download' | 'extract' | 'configure' | 'done' | 'error';
  percent: number;
  detail: string;
}

export interface SloppyKeyboardApi {
  typeCharacter: (character: string) => Promise<TypeResult>;
  pressSpecialKey: (key: SpecialKey) => Promise<TypeResult>;
  drawMinigame: () => Promise<MinigameDraw>;
  runMinigame: (id: MinigameId) => Promise<MinigameResult>;
  debugMode: () => Promise<boolean>;
  debugRunMinigame: (id: MinigameId) => Promise<MinigameResult>;
  debugRunSurprise: (surprise: DebugSurprise) => Promise<MinigameResult>;
  closeWindow: () => void;
  minimizeWindow: () => void;
  sendGooseBalls: (balls: BallSnapshot[], boardBounds: ScreenRect, mysterySlot: ScreenRect | null) => void;
  escapeBall: (ball: BallSnapshot) => void;
  selectCup: (cup: number) => void;
  onGooseState: (listener: (state: GooseState) => void) => () => void;
  onEscapedBall: (listener: (ball: EscapedBall) => void) => () => void;
  onDesktopEffect: (listener: (effect: DesktopEffect) => void) => () => void;
  onGooseSetupProgress: (listener: (progress: GooseSetupProgress) => void) => () => void;
}
