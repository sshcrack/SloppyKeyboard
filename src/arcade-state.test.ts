import { describe, expect, it, vi } from 'vitest';
import {
  pressBackspaceRepeatedly,
  readHighScore,
  resetScore,
  scoreLetter,
  selectDieValue,
} from './arcade-state';

describe('dice helpers', () => {
  it('selects every die face and stays within range', () => {
    expect([0, 0.17, 0.34, 0.51, 0.68, 0.999].map(
      (value) => selectDieValue(() => value),
    )).toEqual([1, 2, 3, 4, 5, 6]);
    expect(selectDieValue(() => -1)).toBe(1);
    expect(selectDieValue(() => 2)).toBe(6);
  });

  it('dispatches exactly the rolled count sequentially and reports failure', async () => {
    let inFlight = 0;
    let overlapped = false;
    const press = vi.fn(async () => {
      inFlight += 1;
      if (inFlight > 1) overlapped = true;
      await Promise.resolve();
      inFlight -= 1;
      return { ok: press.mock.calls.length !== 2 };
    });
    expect(await pressBackspaceRepeatedly(4, press)).toBe(false);
    expect(press).toHaveBeenCalledTimes(4);
    expect(overlapped).toBe(false);
  });
});

describe('score helpers', () => {
  it('awards letters, advances records, and resets only the current score', () => {
    expect(scoreLetter({ score: 100, highScore: 500 })).toEqual({
      score: 200, highScore: 500, newHighScore: false,
    });
    expect(scoreLetter({ score: 500, highScore: 500 })).toEqual({
      score: 600, highScore: 600, newHighScore: true,
    });
    expect(resetScore({ score: 600, highScore: 900 })).toEqual({
      score: 0, highScore: 900, newHighScore: false,
    });
  });

  it('loads only valid non-negative integer records', () => {
    expect(readHighScore('1200')).toBe(1200);
    for (const invalid of [null, '', '-1', '12.5', 'nope', 'Infinity']) {
      expect(readHighScore(invalid)).toBe(0);
    }
  });
});
