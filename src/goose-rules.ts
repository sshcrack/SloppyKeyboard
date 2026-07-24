import type { RandomSource } from './board-state';
export const HUNT_CHANCE = 0.30;
export const ESCAPE_CHANCE = 0.05;
export const shouldHunt = (random: RandomSource = Math.random): boolean => random() < HUNT_CHANCE;
export const shouldEscape = (random: RandomSource = Math.random): boolean => random() < ESCAPE_CHANCE;
