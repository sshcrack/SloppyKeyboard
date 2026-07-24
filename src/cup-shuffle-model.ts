export type CupSwap = readonly [number, number];

export const createCupSwaps = (
  count: number,
  random: () => number = Math.random,
): CupSwap[] => Array.from({ length: count }, () => {
  const first = Math.floor(random() * 5);
  let second = Math.floor(random() * 4);
  if (second >= first) second += 1;
  return [first, second] as const;
});

export const applyCupSwaps = (swaps: readonly CupSwap[]): number[] => {
  const positions = [0, 1, 2, 3, 4];
  for (const [first, second] of swaps) {
    [positions[first], positions[second]] = [positions[second], positions[first]];
  }
  return positions;
};
