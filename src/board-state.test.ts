import { describe, expect, it } from 'vitest';
import { BoardState, generateSlots } from './board-state';

describe('generateSlots', () => {
  it('returns nine unique lowercase letters and one special', () => {
    const slots = generateSlots(() => 0.42);
    const letters = slots
      .filter((slot) => slot.kind === 'letter')
      .map((slot) => slot.kind === 'letter' ? slot.character : '');
    expect(slots).toHaveLength(10);
    expect(letters).toHaveLength(9);
    expect(new Set(letters).size).toBe(9);
    expect(slots.filter((slot) => slot.kind === 'special')).toHaveLength(1);
  });

  it('uses the final random value to relocate the special', () => {
    expect(generateSlots(() => 0)[0]).toEqual({ kind: 'special' });
    expect(generateSlots(() => 0.999)[9]).toEqual({ kind: 'special' });
  });
});

describe('BoardState', () => {
  it('queues one special sequence despite repeated mystery hits', () => {
    const board = new BoardState(() => 0);
    board.launch();
    board.launch();
    expect(board.land(0)).toMatchObject({
      value: { kind: 'special' },
      specialPending: true,
      volleyFinished: false,
    });
    expect(board.land(0)).toMatchObject({
      specialPending: true,
      volleyFinished: true,
    });
  });

  it('keeps slots stable until explicitly rerolled', () => {
    const board = new BoardState(() => 0.2);
    const initial = [...board.slots];
    board.launch();
    expect(board.land(2).volleyFinished).toBe(true);
    expect(board.slots).toEqual(initial);
    board.reroll();
    expect(board.specialPending).toBe(false);
  });

  it('blocks rerolls during a volley and handles abandoned balls', () => {
    const board = new BoardState();
    board.launch();
    board.launch();
    expect(() => board.reroll()).toThrow(/active volley/);
    expect(board.abandon()).toBe(false);
    expect(board.abandon()).toBe(true);
  });
});
