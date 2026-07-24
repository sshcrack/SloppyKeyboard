export const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
export const SLOT_COUNT = 10;

export type RandomSource = () => number;
export type LetterSlot = { kind: 'letter'; character: string };
export type SpecialSlot = { kind: 'special' };
export type SlotValue = LetterSlot | SpecialSlot;

const shuffle = <T>(values: T[], random: RandomSource): T[] => {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [values[index], values[target]] = [values[target], values[index]];
  }
  return values;
};

export const generateSlots = (
  random: RandomSource = Math.random,
): SlotValue[] => {
  const letters = shuffle([...LETTERS], random).slice(0, SLOT_COUNT - 1);
  const specialIndex = Math.floor(random() * SLOT_COUNT);
  const slots: SlotValue[] = letters.map((character) => ({
    kind: 'letter',
    character,
  }));
  slots.splice(specialIndex, 0, { kind: 'special' });
  return slots;
};

export interface Landing {
  value: SlotValue;
  volleyFinished: boolean;
  specialPending: boolean;
}

export class BoardState {
  slots: SlotValue[];
  activeBalls = 0;
  specialPending = false;

  constructor(private readonly random: RandomSource = Math.random) {
    this.slots = generateSlots(random);
  }

  launch(): void {
    this.activeBalls += 1;
  }

  land(slot: number): Landing {
    if (this.activeBalls === 0 || slot < 0 || slot >= SLOT_COUNT) {
      throw new Error('Invalid ball landing.');
    }
    const value = this.slots[slot];
    if (value.kind === 'special') this.specialPending = true;
    this.activeBalls -= 1;
    return {
      value,
      volleyFinished: this.activeBalls === 0,
      specialPending: this.specialPending,
    };
  }

  abandon(): boolean {
    if (this.activeBalls === 0) return false;
    this.activeBalls -= 1;
    return this.activeBalls === 0;
  }

  reroll(): void {
    if (this.activeBalls > 0) {
      throw new Error('Cannot skip during an active volley.');
    }
    this.slots = generateSlots(this.random);
    this.specialPending = false;
  }
}
