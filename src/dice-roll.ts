import { selectDieValue } from './arcade-state';
import type { RandomSource } from './board-state';

const FINAL_ROTATIONS: Record<number, string> = {
  1: 'rotateX(0deg) rotateY(0deg)',
  2: 'rotateX(0deg) rotateY(-90deg)',
  3: 'rotateX(-90deg) rotateY(0deg)',
  4: 'rotateX(90deg) rotateY(0deg)',
  5: 'rotateX(0deg) rotateY(90deg)',
  6: 'rotateX(0deg) rotateY(180deg)',
};

export class DiceRoll {
  private readonly cube: HTMLElement;
  private readonly stage: HTMLButtonElement;
  private readonly status: HTMLElement;
  private readonly result: HTMLElement;

  constructor(private readonly root: HTMLElement) {
    this.cube = this.required('.die');
    this.stage = this.required<HTMLButtonElement>('.die-stage');
    this.status = this.required('.dice-roll__status');
    this.result = this.required('.dice-roll__result');
  }

  async roll(random: RandomSource = Math.random): Promise<number> {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.root.hidden = false;
    this.result.textContent = '';
    this.root.classList.add('dice-roll--waiting');
    this.root.classList.remove('dice-roll--rolling');
    this.status.textContent = 'CLICK THE DIE TO ROLL';
    this.stage.disabled = false;
    this.cube.classList.remove('die--rolling', 'die--settled');
    this.cube.style.transform = '';
    void this.cube.offsetWidth;
    this.stage.focus();
    await new Promise<void>((resolve) => {
      this.stage.addEventListener('click', () => resolve(), { once: true });
    });

    const value = selectDieValue(random);
    this.stage.disabled = true;
    this.root.classList.remove('dice-roll--waiting');
    this.root.classList.add('dice-roll--rolling');
    this.status.textContent = reduced ? 'CALCULATING THROW...' : 'TUMBLING...';
    if (!reduced) this.cube.classList.add('die--rolling');
    await new Promise<void>((resolve) => window.setTimeout(resolve, reduced ? 80 : 1400));
    this.cube.classList.remove('die--rolling');
    this.cube.classList.add('die--settled');
    this.cube.style.transform = FINAL_ROTATIONS[value];
    this.status.textContent = `ROLL COMPLETE · ${value}`;
    this.result.textContent = `${value}× BACKSPACE`;
    await new Promise<void>((resolve) => window.setTimeout(resolve, reduced ? 80 : 420));
    return value;
  }

  setDispatching(): void {
    this.status.textContent = 'TRANSMITTING KEYSTROKES...';
  }

  hide(): void {
    this.root.hidden = true;
    this.root.classList.remove('dice-roll--waiting', 'dice-roll--rolling');
  }

  private required<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing dice element: ${selector}`);
    return element;
  }
}
