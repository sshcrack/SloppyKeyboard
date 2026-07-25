import type { ScreenRect } from './contracts';

export interface VoxelCell {
  x: number;
  y: number;
  z: number;
}

export interface MinecraftScenePlan {
  walkway: VoxelCell[];
  opening: VoxelCell[];
  repairOrder: VoxelCell[];
  cave: VoxelCell[];
}

export const localizeImpact = (
  area: ScreenRect,
  point: { x: number; y: number },
): { x: number; y: number } => ({
  x: point.x - area.x,
  y: point.y - area.y,
});

export const createMinecraftScenePlan = ({
  targetColumn,
  leftColumn,
}: {
  targetColumn: number;
  leftColumn: number;
}): MinecraftScenePlan => {
  const walkway: VoxelCell[] = [];
  for (let x = leftColumn; x <= targetColumn; x += 1) walkway.push({ x, y: 0, z: 0 });

  const opening = [
    { x: targetColumn, y: 1, z: 0 },
    { x: targetColumn, y: 2, z: 0 },
  ];
  const cave: VoxelCell[] = [];
  const add = (x: number, y: number, z: number): void => {
    if (opening.some((cell) => cell.x === x && cell.y === y && cell.z === z)) return;
    if (walkway.some((cell) => cell.x === x && cell.y === y && cell.z === z)) return;
    if (cave.some((cell) => cell.x === x && cell.y === y && cell.z === z)) return;
    cave.push({ x, y, z });
  };

  // A rectangular, block-valid tunnel: floor, ceiling and side walls only.
  for (let z = -1; z >= -5; z -= 1) {
    for (let x = targetColumn - 2; x <= targetColumn + 2; x += 1) {
      add(x, 0, z);
      add(x, 4, z);
    }
    for (let y = 1; y <= 3; y += 1) {
      add(targetColumn - 2, y, z);
      add(targetColumn + 2, y, z);
    }
  }
  return {
    walkway,
    opening,
    repairOrder: [...opening].reverse(),
    cave,
  };
};
