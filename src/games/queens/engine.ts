/**
 * Queens puzzle engine.
 *
 * Rules:
 *  - Place exactly N queens on an N x N grid.
 *  - One queen per row, per column, and per coloured region.
 *  - Queens may not touch, not even diagonally.
 *
 * There are no pre-filled clues: the region map is the whole puzzle, which is
 * why generation checks that the placement is unique whenever possible.
 */

import { hashSeed, mulberry32, shuffle } from "../../lib/random.ts";

export type Difficulty = "easy" | "medium" | "hard" | "deadly";

export interface QueensPuzzle {
  id: string;
  size: number;
  difficulty: Difficulty;
  /** Region id (0..size-1) for every cell, row-major. */
  regions: number[];
  /** Column of the queen in each row. */
  solution: number[];
  /** Number of valid placements found at generation time (capped). */
  solutionCount: number;
}

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "deadly"];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  deadly: "Deadly",
};

export const DIFFICULTY_SIZES: Record<Difficulty, number> = {
  easy: 6,
  medium: 7,
  hard: 8,
  deadly: 9,
};

/* ------------------------------------------------------------------ */
/* Geometry helpers                                                    */
/* ------------------------------------------------------------------ */

export function neighborsOf(size: number, index: number): number[] {
  const r = Math.floor(index / size);
  const c = index % size;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size) out.push(nr * size + nc);
    }
  }
  return out;
}

function orthNeighbors(size: number, index: number): number[] {
  const r = Math.floor(index / size);
  const c = index % size;
  const out: number[] = [];
  if (r > 0) out.push(index - size);
  if (r < size - 1) out.push(index + size);
  if (c > 0) out.push(index - 1);
  if (c < size - 1) out.push(index + 1);
  return out;
}

/* ------------------------------------------------------------------ */
/* Solution generation                                                 */
/* ------------------------------------------------------------------ */

/** Random queen placement: one per row/column, no two adjacent. */
function randomPlacement(size: number, rng: () => number): number[] | null {
  const cols = new Array<number>(size).fill(-1);
  const used = new Array<boolean>(size).fill(false);

  const dfs = (row: number): boolean => {
    if (row === size) return true;
    const blocked = new Array<boolean>(size).fill(false);
    if (row > 0) {
      const prev = cols[row - 1];
      for (let d = -1; d <= 1; d++) {
        const c = prev + d;
        if (c >= 0 && c < size) blocked[c] = true;
      }
    }
    const order = shuffle(
      Array.from({ length: size }, (_, i) => i),
      rng,
    );
    for (const col of order) {
      if (used[col] || blocked[col]) continue;
      cols[row] = col;
      used[col] = true;
      if (dfs(row + 1)) return true;
      used[col] = false;
      cols[row] = -1;
    }
    return false;
  };

  return dfs(0) ? cols : null;
}

/* ------------------------------------------------------------------ */
/* Region growth                                                       */
/* ------------------------------------------------------------------ */

/**
 * Grow one connected region from each queen until the board is covered.
 * Purely random expansion produces crooked, corridor-like regions, which
 * constrain the solver far more than tidy balanced blobs do.
 */
function growRegions(
  size: number,
  queens: readonly number[],
  rng: () => number,
): number[] | null {
  const owner = new Array<number>(size * size).fill(-1);

  queens.forEach((col, row) => {
    owner[row * size + col] = row;
  });

  let remaining = size * size - size;
  let guard = size * size * 60;

  while (remaining > 0) {
    if (guard-- <= 0) return null;

    const candidates: Array<{ cell: number; region: number }> = [];
    for (let index = 0; index < size * size; index++) {
      if (owner[index] !== -1) continue;
      for (const neighbor of orthNeighbors(size, index)) {
        const region = owner[neighbor];
        if (region !== -1) candidates.push({ cell: index, region });
      }
    }
    if (candidates.length === 0) return null;

    const chosen = candidates[Math.floor(rng() * candidates.length)];
    owner[chosen.cell] = chosen.region;
    remaining -= 1;
  }

  return owner;
}

/* ------------------------------------------------------------------ */
/* Solver                                                              */
/* ------------------------------------------------------------------ */

/**
 * Count valid placements, stopping at `limit`.
 * Row-by-row search with column, region and adjacency pruning.
 */
export function countSolutions(
  size: number,
  regions: readonly number[],
  limit = 2,
): number {
  const regionUsed = new Array<boolean>(size).fill(false);
  const colUsed = new Array<boolean>(size).fill(false);
  let solutions = 0;

  const dfs = (row: number): void => {
    if (solutions >= limit) return;
    if (row === size) {
      solutions += 1;
      return;
    }
    for (let col = 0; col < size; col++) {
      if (colUsed[col]) continue;
      if (row > 0) {
        // No adjacency with the queen above (columns are explored in order,
        // so only the previous row can touch this one).
        const above = placements[row - 1];
        if (Math.abs(above - col) <= 1) continue;
      }
      const region = regions[row * size + col];
      if (regionUsed[region]) continue;

      colUsed[col] = true;
      regionUsed[region] = true;
      placements[row] = col;
      dfs(row + 1);
      colUsed[col] = false;
      regionUsed[region] = false;
      if (solutions >= limit) return;
    }
  };

  const placements: number[] = new Array<number>(size).fill(-1);
  dfs(0);
  return solutions;
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export function isSolved(
  size: number,
  regions: readonly number[],
  queens: readonly boolean[],
): boolean {
  let count = 0;
  const rowCount = new Array<number>(size).fill(0);
  const colCount = new Array<number>(size).fill(0);
  const regionCount = new Array<number>(size).fill(0);

  for (let index = 0; index < size * size; index++) {
    if (!queens[index]) continue;
    count += 1;
    const row = Math.floor(index / size);
    const col = index % size;
    rowCount[row] += 1;
    colCount[col] += 1;
    regionCount[regions[index]] += 1;
  }
  if (count !== size) return false;
  if (rowCount.some((n) => n !== 1)) return false;
  if (colCount.some((n) => n !== 1)) return false;
  if (regionCount.some((n) => n !== 1)) return false;

  const queenCells: number[] = [];
  for (let index = 0; index < size * size; index++) if (queens[index]) queenCells.push(index);
  for (let a = 0; a < queenCells.length; a++) {
    for (let b = a + 1; b < queenCells.length; b++) {
      const ra = Math.floor(queenCells[a] / size);
      const ca = queenCells[a] % size;
      const rb = Math.floor(queenCells[b] / size);
      const cb = queenCells[b] % size;
      if (Math.abs(ra - rb) <= 1 && Math.abs(ca - cb) <= 1) return false;
    }
  }
  return true;
}

/** Cells participating in a broken rule (for live feedback). */
export function findConflicts(
  size: number,
  regions: readonly number[],
  queens: readonly boolean[],
): Set<number> {
  const bad = new Set<number>();
  const queenCells: number[] = [];
  for (let index = 0; index < size * size; index++) if (queens[index]) queenCells.push(index);

  const byRow = new Map<number, number[]>();
  const byCol = new Map<number, number[]>();
  const byRegion = new Map<number, number[]>();
  for (const cell of queenCells) {
    const row = Math.floor(cell / size);
    const col = cell % size;
    const region = regions[cell];
    if (!byRow.has(row)) byRow.set(row, []);
    if (!byCol.has(col)) byCol.set(col, []);
    if (!byRegion.has(region)) byRegion.set(region, []);
    byRow.get(row)!.push(cell);
    byCol.get(col)!.push(cell);
    byRegion.get(region)!.push(cell);
  }
  for (const group of [byRow, byCol, byRegion]) {
    for (const cells of group.values()) {
      if (cells.length > 1) cells.forEach((cell) => bad.add(cell));
    }
  }

  for (let a = 0; a < queenCells.length; a++) {
    for (let b = a + 1; b < queenCells.length; b++) {
      const ra = Math.floor(queenCells[a] / size);
      const ca = queenCells[a] % size;
      const rb = Math.floor(queenCells[b] / size);
      const cb = queenCells[b] % size;
      if (Math.abs(ra - rb) <= 1 && Math.abs(ca - cb) <= 1) {
        bad.add(queenCells[a]);
        bad.add(queenCells[b]);
      }
    }
  }
  return bad;
}

/* ------------------------------------------------------------------ */
/* Puzzle generation                                                   */
/* ------------------------------------------------------------------ */

/** How many candidates we are willing to search for a tight puzzle. */
const ATTEMPTS = 180;

export function generatePuzzle(
  seed: string,
  difficulty: Difficulty = "medium",
): QueensPuzzle {
  const size = DIFFICULTY_SIZES[difficulty] ?? 8;
  let best: QueensPuzzle | null = null;

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const rng = mulberry32(hashSeed(`${seed}|queens|${difficulty}|${attempt}`));
    const queens = randomPlacement(size, rng);
    if (!queens) continue;
    const regions = growRegions(size, queens, rng);
    if (!regions) continue;

    // Count with a low cap: most partitions are loose and get rejected fast.
    const solutionCount = countSolutions(size, regions, 24);
    const puzzle: QueensPuzzle = {
      id: `${difficulty}:${seed}`,
      size,
      difficulty,
      regions,
      solution: queens,
      solutionCount,
    };
    if (!best || solutionCount < best.solutionCount) best = puzzle;
    if (solutionCount <= 1) return puzzle;
  }

  if (best) {
    // Refine the reported count for the tightest board we found.
    best.solutionCount = countSolutions(size, best.regions, 60);
    return best;
  }
  throw new Error(`Queens: could not generate a "${difficulty}" puzzle for "${seed}"`);
}

export function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
