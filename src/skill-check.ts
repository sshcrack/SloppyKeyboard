import type { SpecialKey } from './contracts';

const INITIAL_ROTATION_MS = 1450;
const MIN_ROTATION_MS = 360;
const MISS_SPEED_MULTIPLIER = 0.62;
const TARGET_SIZE = 0.13;
const MAX_MISSES = 3;

export class SkillCheck {
  private readonly dial: HTMLElement;
  private readonly label: HTMLElement;
  private readonly needle: HTMLElement;
  private readonly result: HTMLElement;
  private animationFrame?: number;
  private resolve?: (success: boolean) => void;
  private startedAt = 0;
  private targetStart = 0;
  private rotationMs = INITIAL_ROTATION_MS;
  private misses = 0;
  private retryTimer?: number;
  private resolving = false;

  constructor(private readonly root: HTMLElement) {
    this.dial = this.required('.skill-check__dial');
    this.label = this.required('#skill-check-label');
    this.needle = this.required('.skill-check__needle');
    this.result = this.required('#skill-check-result');
    root.addEventListener('pointerdown', (event) => {
      if (event.button === 0) this.attempt();
    });
  }

  run(key: SpecialKey): Promise<boolean> {
    if (this.resolve) this.finish(false);
    this.rotationMs = INITIAL_ROTATION_MS;
    this.misses = 0;
    this.startRound(key);
    this.root.classList.remove('skill-check--success', 'skill-check--miss');
    this.root.hidden = false;
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.animate(this.startedAt);
    });
  }

  stop(): void {
    if (this.retryTimer !== undefined) window.clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    if (this.resolve || this.pendingResolve) this.finish(false);
  }

  private attempt(): void {
    if (!this.resolve || this.resolving) return;
    this.resolving = true;
    const position = this.position(performance.now());
    const success = position >= this.targetStart
      && position <= this.targetStart + TARGET_SIZE;
    this.root.classList.add(
      success ? 'skill-check--success' : 'skill-check--miss',
    );
    if (success) {
      this.result.textContent = 'AUTHORIZED';
      window.setTimeout(() => this.finish(true), 520);
      const resolve = this.resolve;
      this.resolve = undefined;
      this.pendingResolve = resolve;
      return;
    }
    this.misses += 1;
    if (this.misses >= MAX_MISSES) {
      this.result.textContent = '3 STRIKES · MINIGAME PENALTY';
      this.retryTimer = window.setTimeout(() => this.finish(false), 720);
      return;
    }
    this.rotationMs = Math.max(
      MIN_ROTATION_MS,
      Math.round(this.rotationMs * MISS_SPEED_MULTIPLIER),
    );
    this.result.textContent = `ACCESS DENIED · SPEED ${this.misses + 1}X`;
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = undefined;
      if (!this.resolve) return;
      this.startRound();
      this.resolving = false;
    }, 520);
  }

  private pendingResolve?: (success: boolean) => void;

  private finish(success: boolean): void {
    if (this.retryTimer !== undefined) window.clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    this.resolving = false;
    if (this.animationFrame !== undefined) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = undefined;
    }
    this.root.hidden = true;
    const resolve = this.resolve ?? this.pendingResolve;
    this.resolve = undefined;
    this.pendingResolve = undefined;
    resolve?.(success);
  }

  private animate = (now: number): void => {
    const turn = this.position(now);
    this.needle.style.transform = `rotate(${turn}turn)`;
    this.animationFrame = requestAnimationFrame(this.animate);
  };

  private position(now: number): number {
    return ((now - this.startedAt) % this.rotationMs) / this.rotationMs;
  }

  private startRound(key?: SpecialKey): void {
    this.targetStart = 0.08 + Math.random() * 0.79;
    this.dial.style.setProperty('--target-start', `${this.targetStart}turn`);
    this.dial.style.setProperty(
      '--target-end',
      `${this.targetStart + TARGET_SIZE}turn`,
    );
    if (key) {
      this.label.textContent = `Authorize ${key.toUpperCase()}: click in the green zone.`;
    }
    this.result.textContent = this.misses === 0
      ? 'LEFT-CLICK TO ACTIVATE'
      : `RETRY · SPEED ${this.misses + 1}X`;
    this.root.classList.remove('skill-check--success', 'skill-check--miss');
    this.startedAt = performance.now();
  }

  private required(selector: string): HTMLElement {
    const element = this.root.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Missing skill-check element: ${selector}`);
    return element;
  }
}
