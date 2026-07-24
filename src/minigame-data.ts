import type {
  MinigameDescriptor,
  MinigameDraw,
  MinigameId,
} from './contracts';

export const MINIGAMES: readonly MinigameDescriptor[] = [
  {
    id: 'useless-websites',
    label: 'Useless websites',
    description: 'Ten windows. Zero productivity.',
    accent: '#ff00ff',
  },
  {
    id: 'youtube-shorts',
    label: 'YouTube Shorts',
    description: 'Thirty seconds in the vertical void.',
    accent: '#ff0000',
  },
  {
    id: 'desktop-goose',
    label: 'Desktop Goose',
    description: 'Invite a troublesome desktop guest.',
    accent: '#00a8a8',
  },
  {
    id: 'bluescreen',
    label: 'Bluescreen',
    description: 'Solve three sums to recover.',
    accent: '#0000aa',
  },
];

export const isMinigameId = (value: unknown): value is MinigameId =>
  typeof value === 'string'
  && MINIGAMES.some((game) => game.id === value);

export const drawMinigame = (
  random: () => number = Math.random,
): MinigameDraw => {
  const winnerIndex = Math.floor(random() * MINIGAMES.length);
  const winner = MINIGAMES[winnerIndex];
  const reel = Array.from({ length: 25 }, (_, index) =>
    MINIGAMES[index % MINIGAMES.length]);
  const targetIndex = 20 + winnerIndex;
  reel[targetIndex] = winner;
  return { winner, reel };
};

export const USELESS_WEBSITES = [
  'https://pointerpointer.com/',
  'https://theuselessweb.com/',
  'https://cat-bounce.com/',
  'https://longdogechallenge.com/',
  'https://checkboxrace.com/',
  'https://mondrianandme.com/',
  'https://corndog.io/',
  'https://alwaysjudgeabookbyitscover.com/',
  'https://isitchristmas.com/',
  'https://www.staggeringbeauty.com/',
  'https://heeeeeeeey.com/',
  'https://thatsthefinger.com/',
  'http://www.republiquedesmangues.fr/',
  'http://eelslap.com/',
  'http://endless.horse/',
  'https://smashthewalls.com/',
  'https://zoomquilt.org/',
  'https://hackertyper.net/',
  'https://optical.toys/',
  'https://paint.toys/',
];

export const sampleDistinct = <T>(
  values: readonly T[],
  count: number,
  random: () => number = Math.random,
): T[] => {
  const unique = [...new Set(values)];
  for (let index = unique.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [unique[index], unique[target]] = [unique[target], unique[index]];
  }
  return unique.slice(0, count);
};

export interface MathQuestion {
  text: string;
  answer: number;
}

export const createMathQuestions = (
  random: () => number = Math.random,
): MathQuestion[] => {
  const integer = (max: number): number => 1 + Math.floor(random() * max);
  const addA = integer(30);
  const addB = integer(30);
  const subB = integer(20);
  const subA = subB + integer(30);
  const mulA = integer(9);
  const mulB = integer(9);
  return [
    { text: `${addA} + ${addB}`, answer: addA + addB },
    { text: `${subA} − ${subB}`, answer: subA - subB },
    { text: `${mulA} × ${mulB}`, answer: mulA * mulB },
  ];
};
