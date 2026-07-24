import type { RandomSource } from './board-state';

export const HIGH_SCORE_STORAGE_KEY = 'sloppy-keyboard:high-score:v1';
export const LETTER_POINTS = 100;

export interface ScoreState {
  score: number;
  highScore: number;
}

export interface ScoreTransition extends ScoreState {
  newHighScore: boolean;
}

export const selectDieValue = (random: RandomSource = Math.random): number =>
  Math.min(6, Math.max(1, Math.floor(random() * 6) + 1));

export const readHighScore = (stored: string | null): number => {
  if (stored === null || !/^\d+$/.test(stored)) return 0;
  const value = Number(stored);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
};

export const scoreLetter = (state: ScoreState): ScoreTransition => {
  const score = state.score + LETTER_POINTS;
  const newHighScore = score > state.highScore;
  return {
    score,
    highScore: newHighScore ? score : state.highScore,
    newHighScore,
  };
};

export const resetScore = (state: ScoreState): ScoreTransition => ({
  ...state,
  score: 0,
  newHighScore: false,
});

export const pressBackspaceRepeatedly = async (
  count: number,
  press: () => Promise<{ ok: boolean }>,
): Promise<boolean> => {
  let allSucceeded = true;
  for (let index = 0; index < count; index += 1) {
    try {
      const result = await press();
      if (!result.ok) allSucceeded = false;
    } catch {
      allSucceeded = false;
    }
  }
  return allSucceeded;
};
