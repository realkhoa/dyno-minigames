/**
 * Zip puzzle engine.
 *
 * Rules:
 *  - Draw one continuous path through every cell of the grid.
 *  - The path starts on 1 and visits the numbered cells in ascending order.
 *  - No cell may be visited twice and the path never branches.
 *  - Walls between cells cannot be crossed.
 */

import { hashSeed, mulberry32 } from "../../lib/random.ts";
import { areAdjacent, randomPath } from "../../lib/grid.ts";

export type Difficulty = "easy" | "medium" | "hard" | "deadly";

export interface ZipNumber {
  index: number;
  value: number;
}

export type Wall = [number, number];

export interface ZipPuzzle {
  id: string;
  size: number;
  difficulty: Difficulty;
  /** Numbered checkpoints, sorted by value. */
  numbers: ZipNumber[];
  /** One valid full path (cell indices). */
  solution: number[];
  /** Impassable edges, as pairs of adjacent cells. */
  walls: Wall[];
}

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "deadly"];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  deadly: "Deadly",
};

const SETTINGS: Record<Difficulty, { size: number; numbers: number; walls: number }> = {
  easy: { size: 6, numbers: 9, walls: 2 },
  medium: { size: 6, numbers: 6, walls: 4 },
  hard: { size: 7, numbers: 5, walls: 7 },
  deadly: { size: 7, numbers: 4, walls: 10 },
};

export { areAdjacent, cellIndex, neighbors, randomPath } from "../../lib/grid.ts";

export function edgeKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

export function crossesWall(walls: readonly Wall[], a: number, b: number): boolean {
  const key = edgeKey(a, b);
  return walls.some(([x, y]) => edgeKey(x, y) === key);
}

/**
 * Checkpoints are scattered at random along the solution path, so segment
 * lengths vary instead of being evenly spaced.
 */
function pickNumberPositions(length: number, count: number, rng: () => number): number[] {
  const wanted = Math.max(2, Math.min(count, length));
  const positions = new Set<number>([0, length - 1]);
  let guard = 600;
  while (positions.size < wanted && guard-- > 0) {
    positions.add(1 + Math.floor(rng() * (length - 2)));
  }
  return [...positions].sort((a, b) => a - b);
}

/** Walls go on edges the solution never uses, so a path always exists. */
function pickWalls(size: number, path: readonly number[], count: number, rng: () => number): Wall[] {
  const used = new Set<string>();
  for (let i = 1; i < path.length; i++) {
    used.add(edgeKey(path[i - 1], path[i]));
  }

  const candidates: Wall[] = [];
  for (let cell = 0; cell < size * size; cell++) {
    const row = Math.floor(cell / size);
    const col = cell % size;
    if (col + 1 < size && !used.has(edgeKey(cell, cell + 1))) {
      candidates.push([cell, cell + 1]);
    }
    if (row + 1 < size && !used.has(edgeKey(cell, cell + size))) {
      candidates.push([cell, cell + size]);
    }
  }

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  return candidates.slice(0, Math.min(count, candidates.length));
}

export function generatePuzzle(seed: string, difficulty: Difficulty = "medium"): ZipPuzzle {
  const settings = SETTINGS[difficulty] ?? SETTINGS.medium;
  const size = settings.size;

  for (let attempt = 0; attempt < 12; attempt++) {
    const rng = mulberry32(hashSeed(`${seed}|zip|${difficulty}|${attempt}`));
    const path = randomPath(size, rng);
    if (!path) continue;

    const positions = pickNumberPositions(path.length, settings.numbers, rng);
    const numbers: ZipNumber[] = positions.map((position, order) => ({
      index: path[position],
      value: order + 1,
    }));
    const walls = pickWalls(size, path, settings.walls, rng);

    return {
      id: `${difficulty}:${seed}`,
      size,
      difficulty,
      numbers,
      solution: path,
      walls,
    };
  }

  throw new Error(`Zip: could not generate a "${difficulty}" puzzle for "${seed}"`);
}

/** Number of checkpoints already reached by the current path. */
export function reachedCount(path: readonly number[], numbers: readonly ZipNumber[]): number {
  let reached = 0;
  for (const checkpoint of numbers) {
    if (path.includes(checkpoint.index)) reached += 1;
    else break;
  }
  return reached;
}

/** The next checkpoint the player still has to reach, if any. */
export function nextNumber(
  path: readonly number[],
  numbers: readonly ZipNumber[],
): ZipNumber | null {
  const reached = reachedCount(path, numbers);
  return numbers[reached] ?? null;
}

export function isSolved(
  size: number,
  numbers: readonly ZipNumber[],
  path: readonly number[],
  walls: readonly Wall[] = [],
): boolean {
  const total = size * size;
  if (path.length !== total) return false;
  if (new Set(path).size !== total) return false;
  if (path[0] !== numbers[0]?.index) return false;
  for (let i = 1; i < path.length; i++) {
    if (!areAdjacent(size, path[i - 1], path[i])) return false;
    if (crossesWall(walls, path[i - 1], path[i])) return false;
  }

  const order = new Map<number, number>();
  path.forEach((cell, index) => order.set(cell, index));
  if (order.get(numbers[numbers.length - 1].index) !== path.length - 1) return false;
  let previous = -1;
  for (const checkpoint of numbers) {
    const at = order.get(checkpoint.index);
    if (at === undefined || at <= previous) return false;
    previous = at;
  }
  return true;
}

export function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
