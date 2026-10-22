/**
 * Zip puzzle engine.
 *
 * Rules:
 *  - Draw one continuous path through every cell of the grid.
 *  - The path starts on 1 and visits the numbered cells in ascending order.
 *  - No cell may be visited twice and the path never branches.
 */

import { hashSeed, mulberry32, shuffle } from "../../lib/random.ts";

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

export function cellIndex(size: number, row: number, col: number): number {
  return row * size + col;
}

export function neighbors(size: number, index: number): number[] {
  const row = Math.floor(index / size);
  const col = index % size;
  const out: number[] = [];
  if (row > 0) out.push(index - size);
  if (row < size - 1) out.push(index + size);
  if (col > 0) out.push(index - 1);
  if (col < size - 1) out.push(index + 1);
  return out;
}

/** True when the two cells share an edge. */
export function areAdjacent(size: number, a: number, b: number): boolean {
  const ra = Math.floor(a / size);
  const ca = a % size;
  const rb = Math.floor(b / size);
  const cb = b % size;
  return Math.abs(ra - rb) + Math.abs(ca - cb) === 1;
}

/**
 * Random Hamiltonian path: depth-first with a Warnsdorff ordering
 * (visit the most constrained neighbour first) plus a node budget.
 */
export function randomPath(size: number, rng: () => number, budget = 40000): number[] | null {
  const total = size * size;
  const path: number[] = [];
  const visited = new Uint8Array(total);
  let remaining = budget;

  const dfs = (cell: number): boolean => {
    if (remaining-- <= 0) return false;
    path.push(cell);
    visited[cell] = 1;
    if (path.length === total) return true;

    const options = neighbors(size, cell).filter((neighbor) => !visited[neighbor]);
    if (options.length > 0) {
      const scored = options.map((neighbor) => {
        let degree = 0;
        for (const next of neighbors(size, neighbor)) {
          if (!visited[next]) degree += 1;
        }
        return { neighbor, score: degree + rng() * 0.8 };
      });
      scored.sort((a, b) => a.score - b.score);
      for (const { neighbor } of scored) {
        if (dfs(neighbor)) return true;
        if (remaining <= 0) break;
      }
    }

    path.pop();
    visited[cell] = 0;
    return false;
  };

  for (const start of shuffle(Array.from({ length: total }, (_, i) => i), rng)) {
    if (dfs(start)) return path.slice();
    path.length = 0;
    visited.fill(0);
    if (remaining <= 0) break;
  }
  return null;
}

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
