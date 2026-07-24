import { describe, expect, it } from 'vitest';
import { shouldEscape, shouldHunt } from './goose-rules';
describe('Goose probability decisions', () => {
  it('uses a strict 30% hunt boundary', () => {
    expect(shouldHunt(() => 0.299999)).toBe(true);
    expect(shouldHunt(() => 0.3)).toBe(false);
  });
  it('uses a strict 5% escape boundary', () => {
    expect(shouldEscape(() => 0.049999)).toBe(true);
    expect(shouldEscape(() => 0.05)).toBe(false);
  });
});
