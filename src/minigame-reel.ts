import type { MinigameDescriptor, MinigameDraw } from './contracts';

const CARD_WIDTH = 210;
const REEL_DURATION_MS = 4000;

export class MinigameReel {
  private readonly title: HTMLElement;
  private readonly track: HTMLElement;
  private readonly result: HTMLElement;

  constructor(private readonly overlay: HTMLElement) {
    const title = overlay.querySelector<HTMLElement>('#selector-title');
    const track = overlay.querySelector<HTMLElement>('#reel-track');
    const result = overlay.querySelector<HTMLElement>('#selector-result');
    if (!title || !track || !result) throw new Error('Selector is incomplete.');
    this.title = title;
    this.track = track;
    this.result = result;
  }

  async spin(draw: MinigameDraw): Promise<MinigameDescriptor> {
    this.renderCards(draw.reel);
    this.title.textContent = 'SELECTING PENALTY...';
    this.result.textContent = 'The machine is deciding.';
    this.overlay.hidden = false;
    const candidates = draw.reel
      .map((game, index) => game.id === draw.winner.id ? index : -1)
      .filter((index) => index >= 0);
    const targetIndex = candidates[candidates.length - 1];
    const viewport = this.track.parentElement;
    if (!viewport) throw new Error('Reel viewport is unavailable.');
    const finalX = viewport.clientWidth / 2
      - (targetIndex + 0.5) * CARD_WIDTH;
    await this.animateTo(finalX);
    this.title.textContent = draw.winner.label.toUpperCase();
    this.result.textContent = draw.winner.description;
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    return draw.winner;
  }

  hide(): void {
    this.overlay.hidden = true;
    this.track.replaceChildren();
  }

  private renderCards(games: MinigameDescriptor[]): void {
    this.track.replaceChildren(...games.map((game) => {
      const card = document.createElement('article');
      card.className = 'reel-card';
      card.style.setProperty('--accent', game.accent);
      const label = document.createElement('strong');
      label.textContent = game.label;
      const description = document.createElement('span');
      description.textContent = game.description;
      card.append(label, description);
      return card;
    }));
    this.track.style.transform = 'translateX(0px)';
  }

  private animateTo(finalX: number): Promise<void> {
    const start = performance.now();
    return new Promise((resolve) => {
      const frame = (now: number): void => {
        const progress = Math.min(1, (now - start) / REEL_DURATION_MS);
        const eased = 1 - (1 - progress) ** 4;
        const steppedX = Math.round((finalX * eased) / 4) * 4;
        this.track.style.transform = `translateX(${steppedX}px)`;
        if (progress < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
  }
}
