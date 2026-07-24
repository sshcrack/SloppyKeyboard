/** Coordinates passive surprises so a playful effect never piles onto another. */
export class SurpriseScheduler {
  private nextNaturalAt = 0;
  private active = new Set<string>();
  private awake = true;

  constructor(private readonly random: () => number = Math.random) {}

  begin(name: string): boolean {
    if (!this.awake || this.active.size > 0) return false;
    this.active.add(name);
    return true;
  }

  end(name: string): void { this.active.delete(name); }
  setAwake(awake: boolean): void { this.awake = awake; }
  get busy(): boolean { return this.active.size > 0; }

  scheduleNatural(now: number): void {
    this.nextNaturalAt = now + (5 + this.random() * 3) * 60_000;
  }

  takeNatural(now: number): boolean {
    if (!this.awake || this.busy || now < this.nextNaturalAt) return false;
    this.scheduleNatural(now);
    return true;
  }
}

export const omenDelayMs = (random: () => number = Math.random): number =>
  (2 + random() * 4) * 60_000;
