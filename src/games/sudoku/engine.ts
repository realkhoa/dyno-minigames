/**
 * Mini Sudoku engine: 6x6 grid, 2x3 boxes, digits 1-6.
 */

import { hashSeed, mulberry32, shuffle } from "../../lib/random.ts";

export type Difficulty = "easy" | "medium" | "hard" | "deadly";

export const SIZE = 6;
export const BOX_ROWS = 2;
export const BOX_COLS = 3;
export const DIGITS = [1, 2, 3, 4, 5, 6];
const ALL = 0b1111110;

export interface SudokuPuzzle {
  id: string;
  difficulty: Difficulty;
  givens: number[];
  solution: number[];
  solutionCount: number;
}

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "deadly"];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  deadly: "Deadly",
};

/** Minimum number of clues kept while carving. */
const MIN_GIVENS: Record<Difficulty, number> = {
  easy: 22,
  medium: 18,
  hard: 14,
  deadly: 0,
};

export function boxIndex(row: number, col: number): number {
  return Math.floor(row / BOX_ROWS) * 2 + Math.floor(col / BOX_COLS);
}

function popcount(value: number): number {
  let count = 0;
  let v = value;
  while (v) {
    count += v & 1;
    v >>= 1;
  }
  return count;
}

function masksFrom(cells: readonly number[]): {
  rows: number[];
  cols: number[];
  boxes: number[];
  ok: boolean;
} {
  const rows = new Array<number>(SIZE).fill(0);
  const cols = new Array<number>(SIZE).fill(0);
  const boxes = new Array<number>(SIZE).fill(0);

  for (let i = 0; i < SIZE * SIZE; i++) {
    const value = cells[i];
    if (!value) continue;
    const row = Math.floor(i / SIZE);
    const col = i % SIZE;
    const box = boxIndex(row, col);
    const bit = 1 << value;
    if (rows[row] & bit || cols[col] & bit || boxes[box] & bit) {
      return { rows, cols, boxes, ok: false };
    }
    rows[row] |= bit;
    cols[col] |= bit;
    boxes[box] |= bit;
  }
  return { rows, cols, boxes, ok: true };
}

/** Count solutions, stopping at `limit`. */
export function countSolutions(givens: readonly number[], limit = 2): number {
  const cells = givens.slice();
  const { rows, cols, boxes, ok } = masksFrom(cells);
  if (!ok) return 0;

  let found = 0;

  const dfs = (): void => {
    if (found >= limit) return;

    let target = -1;
    let targetMask = 0;
    let targetCount = 7;

    for (let i = 0; i < SIZE * SIZE; i++) {
      if (cells[i]) continue;
      const row = Math.floor(i / SIZE);
      const col = i % SIZE;
      const box = boxIndex(row, col);
      const available = ALL & ~(rows[row] | cols[col] | boxes[box]);
      if (available === 0) return;
      const count = popcount(available);
      if (count < targetCount) {
        target = i;
        targetMask = available;
        targetCount = count;
        if (count === 1) break;
      }
    }

    if (target === -1) {
      found += 1;
      return;
    }

    const row = Math.floor(target / SIZE);
    const col = target % SIZE;
    const box = boxIndex(row, col);

    for (let value = 1; value <= SIZE; value++) {
      const bit = 1 << value;
      if (!(targetMask & bit)) continue;
      cells[target] = value;
      rows[row] |= bit;
      cols[col] |= bit;
      boxes[box] |= bit;
      dfs();
      cells[target] = 0;
      rows[row] &= ~bit;
      cols[col] &= ~bit;
      boxes[box] &= ~bit;
      if (found >= limit) return;
    }
  };

  dfs();
  return found;
}

function fillGrid(rng: () => number): number[] {
  const cells = new Array<number>(SIZE * SIZE).fill(0);
  const rows = new Array<number>(SIZE).fill(0);
  const cols = new Array<number>(SIZE).fill(0);
  const boxes = new Array<number>(SIZE).fill(0);

  const dfs = (index: number): boolean => {
    if (index === SIZE * SIZE) return true;
    const row = Math.floor(index / SIZE);
    const col = index % SIZE;
    const box = boxIndex(row, col);
    const used = rows[row] | cols[col] | boxes[box];
    for (const value of shuffle(DIGITS, rng)) {
      const bit = 1 << value;
      if (used & bit) continue;
      cells[index] = value;
      rows[row] |= bit;
      cols[col] |= bit;
      boxes[box] |= bit;
      if (dfs(index + 1)) return true;
      cells[index] = 0;
      rows[row] &= ~bit;
      cols[col] &= ~bit;
      boxes[box] &= ~bit;
    }
    return false;
  };

  if (!dfs(0)) throw new Error("Sudoku: could not fill the grid");
  return cells;
}

export function generatePuzzle(
  seed: string,
  difficulty: Difficulty = "medium",
): SudokuPuzzle {
  const minGivens = MIN_GIVENS[difficulty] ?? 18;

  for (let attempt = 0; attempt < 30; attempt++) {
    const rng = mulberry32(hashSeed(`${seed}|sudoku|${difficulty}|${attempt}`));
    const solution = fillGrid(rng);
    const givens = solution.slice();
    let clues = SIZE * SIZE;

    for (const index of shuffle(Array.from({ length: SIZE * SIZE }, (_, i) => i), rng)) {
      if (clues <= minGivens) break;
      const previous = givens[index];
      givens[index] = 0;
      if (countSolutions(givens, 2) === 1) clues -= 1;
      else givens[index] = previous;
    }

    const solutionCount = countSolutions(givens, 2);
    if (solutionCount === 1) {
      return {
        id: `${difficulty}:${seed}`,
        difficulty,
        givens,
        solution,
        solutionCount,
      };
    }
  }

  throw new Error(`Sudoku: could not generate a "${difficulty}" puzzle for "${seed}"`);
}

export function isSolved(cells: readonly number[]): boolean {
  if (cells.length !== SIZE * SIZE) return false;
  if (cells.some((value) => value < 1 || value > SIZE)) return false;

  for (let row = 0; row < SIZE; row++) {
    let mask = 0;
    for (let col = 0; col < SIZE; col++) mask |= 1 << cells[row * SIZE + col];
    if (mask !== ALL) return false;
  }
  for (let col = 0; col < SIZE; col++) {
    let mask = 0;
    for (let row = 0; row < SIZE; row++) mask |= 1 << cells[row * SIZE + col];
    if (mask !== ALL) return false;
  }
  for (let box = 0; box < SIZE; box++) {
    const rowStart = Math.floor(box / 2) * BOX_ROWS;
    const colStart = (box % 2) * BOX_COLS;
    let mask = 0;
    for (let r = 0; r < BOX_ROWS; r++) {
      for (let c = 0; c < BOX_COLS; c++) {
        mask |= 1 << cells[(rowStart + r) * SIZE + colStart + c];
      }
    }
    if (mask !== ALL) return false;
  }
  return true;
}

/** Cells that duplicate another value in their row, column or box. */
export function findConflicts(cells: readonly number[]): Set<number> {
  const bad = new Set<number>();

  const mark = (indices: number[]) => {
    const seen = new Map<number, number[]>();
    for (const index of indices) {
      const value = cells[index];
      if (!value) continue;
      if (!seen.has(value)) seen.set(value, []);
      seen.get(value)!.push(index);
    }
    for (const group of seen.values()) {
      if (group.length > 1) group.forEach((index) => bad.add(index));
    }
  };

  for (let row = 0; row < SIZE; row++) {
    mark(Array.from({ length: SIZE }, (_, col) => row * SIZE + col));
  }
  for (let col = 0; col < SIZE; col++) {
    mark(Array.from({ length: SIZE }, (_, row) => row * SIZE + col));
  }
  for (let box = 0; box < SIZE; box++) {
    const rowStart = Math.floor(box / 2) * BOX_ROWS;
    const colStart = (box % 2) * BOX_COLS;
    const indices: number[] = [];
    for (let r = 0; r < BOX_ROWS; r++) {
      for (let c = 0; c < BOX_COLS; c++) {
        indices.push((rowStart + r) * SIZE + colStart + c);
      }
    }
    mark(indices);
  }

  return bad;
}

export function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
