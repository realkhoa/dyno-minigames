/**
 * Zip puzzle engine.
 *
 * Rules:
 *  - Draw one continuous path through every cell of the grid.
 *  - The path starts on 1 and visits the numbered cells in ascending order.
 *  - No cell may be visited twice and the path never branches.
 */

import { hashSeed, mulberry32 } from "../../lib/random.ts";
import { areAdjacent, randomPath } from "../../lib/grid.ts";

export type Difficulty = "easy" | "medium" | "hard" | "deadly";

export interface ZipNumber {
  index: number;
  value: number;
}

export interface ZipPuzzle {
  id: string;
  size: number;
  difficulty: Difficulty;
  /** Numbered checkpoints, sorted by value. */
  numbers: ZipNumber[];
  /** One valid full path (cell indices). */
  solution: number[];
}

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "deadly"];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  deadly: "Deadly",
};

const SETTINGS: Record<Difficulty, { size: number; numbers: number }> = {
  easy: { size: 5, numbers: 8 },
  medium: { size: 6, numbers: 8 },
  hard: { size: 6, numbers: 5 },
  deadly: { size: 7, numbers: 5 },
};

export { areAdjacent, cellIndex, neighbors, randomPath } from "../../lib/grid.ts";

function pickNumberPositions(length: number, count: number, rng: () => number): number[] {
  const slots = Math.max(0, Math.min(count - 2, length - 2));
  const positions: number[] = [0];

  for (let k = 0; k < slots; k++) {
    const from = 1 + Math.floor(((length - 2) * k) / slots);
    const to = Math.floor(((length - 2) * (k + 1)) / slots);
    const span = Math.max(1, to - from + 1);
    positions.push(from + Math.floor(rng() * span));
  }
  positions.push(length - 1);
  return positions;
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

    return {
      id: `${difficulty}:${seed}`,
      size,
      difficulty,
      numbers,
      solution: path,
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
): boolean {
  const total = size * size;
  if (path.length !== total) return false;
  if (new Set(path).size !== total) return false;
  if (path[0] !== numbers[0]?.index) return false;
  for (let i = 1; i < path.length; i++) {
    if (!areAdjacent(size, path[i - 1], path[i])) return false;
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
