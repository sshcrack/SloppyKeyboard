import { describe, expect, it } from 'vitest';
import { canvasToScreen, screenToCanvas } from './coordinates';
describe('screen/canvas coordinates', () => {
  it('round trips on a negatively positioned display', () => {
    const bounds = { x: -1910, y: -200, width: 880, height: 560 };
    const screen = canvasToScreen({ x: 440, y: 280 }, bounds, 880, 560);
    expect(screen).toEqual({ x: -1470, y: 80 });
    expect(screenToCanvas(screen, bounds, 880, 560)).toEqual({ x: 440, y: 280 });
  });
});
