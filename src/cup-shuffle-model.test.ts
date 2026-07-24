import { describe, expect, it } from 'vitest';
import { applyCupSwaps, createCupSwaps } from './cup-shuffle-model';

describe('cup shuffle', () => {
  it('always swaps two distinct cups and preserves a five-cup permutation', () => {
    const swaps = createCupSwaps(14, () => 0);
    expect(swaps).toHaveLength(14);
    expect(swaps.every(([a, b]) => a !== b)).toBe(true);
    expect([...applyCupSwaps(swaps)].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('tracks cup identities through swaps', () => {
    expect(applyCupSwaps([[0, 4], [1, 3], [4, 2]])).toEqual([4, 3, 0, 1, 2]);
  });
});
