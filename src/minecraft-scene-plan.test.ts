import { describe, expect, it } from 'vitest';
import { createMinecraftScenePlan, localizeImpact } from './minecraft-scene-plan';

describe('Minecraft surprise scene plan', () => {
  it('builds a left-to-right voxel walkway and exactly one two-block doorway', () => {
    const plan = createMinecraftScenePlan({ targetColumn: 3, leftColumn: -7 });

    expect(plan.walkway.map(({ x }) => x)).toEqual([
      -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3,
    ]);
    expect(plan.walkway.every(({ y, z }) => y === 0 && z === 0)).toBe(true);
    expect(plan.opening).toEqual([
      { x: 3, y: 1, z: 0 },
      { x: 3, y: 2, z: 0 },
    ]);
    expect(plan.repairOrder).toEqual([...plan.opening].reverse());
  });

  it('uses only axis-aligned integer voxels for the cave', () => {
    const plan = createMinecraftScenePlan({ targetColumn: 1, leftColumn: -6 });
    const cells = [...plan.walkway, ...plan.cave, ...plan.opening];
    const keys = new Set(cells.map(({ x, y, z }) => `${x}:${y}:${z}`));

    expect(keys.size).toBe(cells.length);
    expect(cells.every(({ x, y, z }) =>
      Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z))).toBe(true);
    expect(plan.cave.some(({ z }) => z <= -4)).toBe(true);
  });
});

describe('desktop effect coordinates', () => {
  it('localizes an impact correctly on a monitor with negative coordinates', () => {
    expect(localizeImpact(
      { x: -1920, y: -180, width: 1920, height: 1080 },
      { x: -1500, y: 300 },
    )).toEqual({ x: 420, y: 480 });
  });
});
