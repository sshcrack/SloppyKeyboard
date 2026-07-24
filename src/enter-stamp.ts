export class EnterStamp {
  private readonly cover: HTMLButtonElement;
  private readonly plunger: HTMLButtonElement;
  private readonly status: HTMLElement;
  private readonly result: HTMLElement;

  constructor(private readonly root: HTMLElement) {
    this.cover = this.required<HTMLButtonElement>('.enter-stamp__cover');
    this.plunger = this.required<HTMLButtonElement>('.enter-stamp__plunger');
    this.status = this.required('.enter-stamp__status');
    this.result = this.required('.enter-stamp__result');
  }

  async authorize(): Promise<void> {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.root.hidden = false;
    this.root.classList.remove('enter-stamp--armed', 'enter-stamp--slammed');
    this.cover.disabled = false;
    this.plunger.disabled = true;
    this.status.textContent = 'LIFT SAFETY COVER';
    this.result.textContent = 'ENTER KEY REQUIRES MANUAL AUTHORIZATION';
    this.cover.focus();

    await this.onceClicked(this.cover);
    this.cover.disabled = true;
    this.plunger.disabled = false;
    this.root.classList.add('enter-stamp--armed');
    this.status.textContent = 'COVER OPEN · SLAM ENTER';
    this.result.textContent = 'WARNING: DOCUMENT MAY BE SUBMITTED';
    this.plunger.focus();

    await this.onceClicked(this.plunger);
    this.plunger.disabled = true;
    this.root.classList.add('enter-stamp--slammed');
    this.status.textContent = 'ENTER AUTHORIZED';
    this.result.textContent = 'THUNK!';
    await new Promise<void>((resolve) =>
      window.setTimeout(resolve, reduced ? 80 : 520));
  }

  setDispatching(): void {
    this.status.textContent = 'TRANSMITTING CARRIAGE RETURN...';
  }

  hide(): void {
    this.root.hidden = true;
    this.root.classList.remove('enter-stamp--armed', 'enter-stamp--slammed');
  }

  private onceClicked(button: HTMLButtonElement): Promise<void> {
    return new Promise((resolve) => {
      button.addEventListener('click', () => resolve(), { once: true });
    });
  }

  private required<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing Enter stamp element: ${selector}`);
    return element;
  }
}
