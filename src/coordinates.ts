import type { ScreenRect } from './contracts';
export interface Point { x: number; y: number }
export const canvasToScreen = (point: Point, canvas: ScreenRect, logicalWidth: number, logicalHeight: number): Point => ({
  x: canvas.x + point.x * canvas.width / logicalWidth,
  y: canvas.y + point.y * canvas.height / logicalHeight,
});
export const screenToCanvas = (point: Point, canvas: ScreenRect, logicalWidth: number, logicalHeight: number): Point => ({
  x: (point.x - canvas.x) * logicalWidth / canvas.width,
  y: (point.y - canvas.y) * logicalHeight / canvas.height,
});
