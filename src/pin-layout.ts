export const BALL_RADIUS = 9;
export const PIN_RADIUS = 6.5;
export const PIN_SPACING = 42;
export const PIN_ROW_COUNT = 9;
export const PIN_ROW_GAP = 43;
export const FIRST_PIN_ROW_Y = 105;

const X_JITTER = 1.5;
const Y_JITTER = 3;
const WALL_INSET = 17;
const COLLISION_RADIUS = BALL_RADIUS + PIN_RADIUS;

export interface PinPosition {
  x: number;
  y: number;
}

type RandomSource = () => number;

const buildLayout = (
  boardWidth: number,
  random: RandomSource,
  jitterPins: boolean,
): PinPosition[] => {
  const pins: PinPosition[] = [];
  const origin = random() * PIN_SPACING;
  const columns = Math.ceil(boardWidth / PIN_SPACING) + 2;

  for (let row = 0; row < PIN_ROW_COUNT; row += 1) {
    const phase = origin
      + (row % 3) * (PIN_SPACING / 3)
      + (random() - 0.5) * 2;
    const y = FIRST_PIN_ROW_Y
      + row * PIN_ROW_GAP
      + (random() - 0.5) * Y_JITTER * 2;

    for (let column = -2; column <= columns; column += 1) {
      const jitter = jitterPins ? (random() - 0.5) * X_JITTER * 2 : 0;
      const x = phase + column * PIN_SPACING + jitter;
      if (x > 12 && x < boardWidth - 12) pins.push({ x, y });
    }
  }
  return pins;
};

export const hasStraightDropCorridor = (
  pins: PinPosition[],
  boardWidth: number,
): boolean => {
  for (let x = WALL_INSET; x <= boardWidth - WALL_INSET; x += 0.5) {
    const intercepted = pins.some(
      (pin) => Math.abs(pin.x - x) <= COLLISION_RADIUS,
    );
    if (!intercepted) return true;
  }
  return false;
};

export const createPinLayout = (
  boardWidth: number,
  random: RandomSource = Math.random,
): PinPosition[] => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = buildLayout(boardWidth, random, true);
    if (!hasStraightDropCorridor(candidate, boardWidth)) return candidate;
  }

  return buildLayout(boardWidth, random, false);
};
