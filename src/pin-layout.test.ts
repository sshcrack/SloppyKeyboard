import { describe, expect, it } from 'vitest';
import {
  BALL_RADIUS,
  FIRST_PIN_ROW_Y,
  PIN_RADIUS,
  PIN_ROW_GAP,
  PIN_ROW_COUNT,
  createPinLayout,
  hasStraightDropCorridor,
} from './pin-layout';

const seededRandom = (seed: number): (() => number) => {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
};

describe('pin layout', () => {
  it('has no controllable straight-through corridor', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const pins = createPinLayout(880, seededRandom(seed));
      expect(hasStraightDropCorridor(pins, 880)).toBe(false);
    }
  });

  it('keeps enough clearance for a ball between neighboring pins', () => {
    const pins = createPinLayout(880, seededRandom(7));
    const requiredGap = 2 * (BALL_RADIUS + PIN_RADIUS);

    for (let row = 0; row < PIN_ROW_COUNT; row += 1) {
      const rowPins = pins
        .filter((pin) =>
          Math.round((pin.y - FIRST_PIN_ROW_Y) / PIN_ROW_GAP) === row,
        )
        .sort((left, right) => left.x - right.x);
      for (let index = 1; index < rowPins.length; index += 1) {
        expect(rowPins[index].x - rowPins[index - 1].x)
          .toBeGreaterThan(requiredGap);
      }
    }
  });
});
