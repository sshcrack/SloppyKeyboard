import { describe, expect, it } from 'vitest';
import { SurpriseScheduler, omenDelayMs } from './surprise-scheduler';

describe('SurpriseScheduler', () => {
  it('excludes overlapping effects and respects its 5–8 minute window', () => {
    const scheduler = new SurpriseScheduler(() => 0);
    scheduler.scheduleNatural(100);
    expect(scheduler.takeNatural(300_099)).toBe(false);
    expect(scheduler.takeNatural(300_100)).toBe(true);
    expect(scheduler.begin('cup')).toBe(true);
    expect(scheduler.begin('eyes')).toBe(false);
  });
  it('uses the requested 2–6 minute omen range', () => {
    expect(omenDelayMs(() => 0)).toBe(120_000);
    expect(omenDelayMs(() => 1)).toBe(360_000);
  });
});
