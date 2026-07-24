import { describe, expect, it } from 'vitest';
import {
  MINIGAMES,
  USELESS_WEBSITES,
  createMathQuestions,
  drawMinigame,
  isMinigameId,
  sampleDistinct,
} from './minigame-data';

describe('minigame draw', () => {
  it('selects registered games with equal-sized random ranges', () => {
    expect(drawMinigame(() => 0).winner).toEqual(MINIGAMES[0]);
    expect(drawMinigame(() => 0.26).winner).toEqual(MINIGAMES[1]);
    expect(drawMinigame(() => 0.51).winner).toEqual(MINIGAMES[2]);
    expect(drawMinigame(() => 0.99).winner).toEqual(MINIGAMES[3]);
  });

  it('validates only registry IDs', () => {
    expect(isMinigameId('bluescreen')).toBe(true);
    expect(isMinigameId('not-a-game')).toBe(false);
    expect(isMinigameId(null)).toBe(false);
  });
});

describe('useless website selection', () => {
  it('samples ten unique valid HTTP(S) URLs', () => {
    const sample = sampleDistinct(USELESS_WEBSITES, 10, () => 0.37);
    expect(sample).toHaveLength(10);
    expect(new Set(sample).size).toBe(10);
    expect(sample.every((url) => ['http:', 'https:'].includes(
      new URL(url).protocol,
    ))).toBe(true);
    expect(USELESS_WEBSITES.some((url) => url.startsWith('http://'))).toBe(true);
  });
});

describe('math questions', () => {
  it('generates bounded addition, subtraction, and multiplication', () => {
    const questions = createMathQuestions(() => 0.5);
    expect(questions).toHaveLength(3);
    expect(questions[0].text).toContain('+');
    expect(questions[1].text).toContain('−');
    expect(questions[1].answer).toBeGreaterThanOrEqual(0);
    expect(questions[2].text).toContain('×');
    expect(questions.every((question) =>
      Number.isInteger(question.answer))).toBe(true);
  });
});
