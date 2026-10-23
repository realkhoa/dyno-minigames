/**
 * Patches puzzle engine.
 *
 * Rules:
 *  - Split the whole grid into rectangles (squares count as rectangles).
 *  - Every rectangle contains exactly one clue cell.
 *  - The clue's number is the area of its rectangle.
 *  - No overlaps and no uncovered cells.
 *
 * Boards are built by filling the grid from the top-left-most free cell with
 * randomly sized rectangles. That produces small, irregular patches instead of
 * the tidy guillotine cuts a recursive splitter makes. A Shikaku solver then
 * counts the tilings, and the generator keeps the tightest board it finds.
 */

import { hashSeed, mulberry32 } from "../../lib/random.ts";

export type Difficulty = "easy" | "medium" | "hard" | "deadly";

export interface PatchClue {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Area of the patch, which is the clue number. */
  area: number;
}

export interface PatchesPuzzle {
  id: string;
  size: number;
  difficulty: Difficulty;
  clues: PatchClue[];
  /** The tiling the board was generated from. */
  solution: PatchClue[];
  /** Number of valid tilings (capped at 2 during generation). */
  solutionCount: number;
}

export interface PlacedPatch {
  x: number;
  y: number;
  w: number;
  h: number;
  clueX: number;
  clueY: number;
}

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "deadly"];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  deadly: "Deadly",
};

const SETTINGS: Record<Difficulty, { size: number; patches: number; maxArea: number }> = {
  easy: { size: 6, patches: 10, maxArea: 5 },
  medium: { size: 7, patches: 12, maxArea: 6 },
  hard: { size: 8, patches: 14, maxArea: 7 },
  deadly: { size: 9, patches: 16, maxArea: 8 },
};

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const areaOf = (rect: Rect) => rect.w * rect.h;

/* ------------------------------------------------------------------ */
/* Tiling                                                              */
/* ------------------------------------------------------------------ */

function fits(
  filled: Uint8Array,
  size: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
): boolean {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (filled[y * size + x]) return false;
    }
  }
  return true;
}

/**
 * Fill the board with exactly `target` rectangles of 2..maxArea cells.
 * The first free cell (row-major) is always the top-left corner of the next
 * patch, which keeps the partition valid while allowing irregular shapes.
 */
function tileBoard(
  size: number,
  target: number,
  maxArea: number,
  rng: () => number,
): Rect[] | null {
  const total = size * size;
  const filled = new Uint8Array(total);
  const rects: Rect[] = [];
  let budget = 60000;

  const collect = (minArea: number, maxAllowed: number, x0: number, y0: number) => {
    const options: Array<{ w: number; h: number }> = [];
    for (let h = 1; y0 + h <= size; h++) {
      if (filled[(y0 + h - 1) * size + x0]) break;
      for (let w = 1; x0 + w <= size; w++) {
        const area = w * h;
        if (area > maxAllowed) break;
        if (area < minArea) continue;
        if (fits(filled, size, x0, y0, w, h)) options.push({ w, h });
        if (filled[y0 * size + x0 + w - 1]) break;
      }
    }
    return options;
  };

  const dfs = (free: number): boolean => {
    if (free === 0) return rects.length === target;
    if (rects.length >= target) return false;
    if (budget-- <= 0) return false;
    const remaining = target - rects.length;
    if (free < remaining * 2) return false;

    let first = -1;
    for (let i = 0; i < total; i++) {
      if (!filled[i]) {
        first = i;
        break;
      }
    }
    if (first < 0) return false;
    const x0 = first % size;
    const y0 = Math.floor(first / size);

    const ideal = free / remaining;
    let options = collect(Math.max(2, Math.floor(ideal) - 1), Math.min(maxArea, Math.ceil(ideal) + 1), x0, y0);
    if (options.length === 0) options = collect(2, maxArea, x0, y0);
    if (options.length === 0) return false;

    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }

    for (const { w, h } of options) {
      for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + w; x++) filled[y * size + x] = 1;
      }
      rects.push({ x: x0, y: y0, w, h });
      if (dfs(free - w * h)) return true;
      rects.pop();
      for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + w; x++) filled[y * size + x] = 0;
      }
      if (budget <= 0) return false;
    }
    return false;
  };

  return dfs(total) ? rects.slice() : null;
}

/* ------------------------------------------------------------------ */
/* Solver                                                              */
/* ------------------------------------------------------------------ */

/**
 * Count valid tilings, stopping at `limit`.
 * The first uncovered cell must be inside exactly one clue's rectangle.
 */
export function countSolutions(puzzle: PatchesPuzzle, limit = 2): number {
  const size = puzzle.size;
  const total = size * size;
  const clues = puzzle.clues;
  const covered = new Uint8Array(total);
  const used = new Uint8Array(clues.length);
  const owner = new Int16Array(total).fill(-1);
  clues.forEach((clue, index) => {
    owner[clue.y * size + clue.x] = index;
  });

  let unusedArea = clues.reduce((sum, clue) => sum + clue.area, 0);
  let free = total;
  let count = 0;

  const dfs = (): void => {
    if (count >= limit) return;
    if (free !== unusedArea) return;

    let first = -1;
    for (let i = 0; i < total; i++) {
      if (!covered[i]) {
        first = i;
        break;
      }
    }
    if (first < 0) {
      count += 1;
      return;
    }
    const fx = first % size;
    const fy = Math.floor(first / size);

    for (let ci = 0; ci < clues.length; ci++) {
      if (used[ci]) continue;
      const clue = clues[ci];
      const area = clue.area;

      for (let w = 1; w <= area; w++) {
        if (area % w !== 0) continue;
        const h = area / w;
        if (w > size || h > size) continue;

        const rxMin = Math.max(0, clue.x - w + 1, fx - w + 1);
        const rxMax = Math.min(clue.x, size - w, fx);
        const ryMin = Math.max(0, clue.y - h + 1, fy - h + 1);
        const ryMax = Math.min(clue.y, size - h, fy);
        if (rxMin > rxMax || ryMin > ryMax) continue;

        for (let ry = ryMin; ry <= ryMax; ry++) {
          for (let rx = rxMin; rx <= rxMax; rx++) {
            let ok = true;
            for (let y = ry; y < ry + h && ok; y++) {
              for (let x = rx; x < rx + w; x++) {
                const cell = y * size + x;
                if (covered[cell]) {
                  ok = false;
                  break;
                }
                const cellOwner = owner[cell];
                if (cellOwner !== -1 && cellOwner !== ci) {
                  ok = false;
                  break;
                }
              }
            }
            if (!ok) continue;

            for (let y = ry; y < ry + h; y++) {
              for (let x = rx; x < rx + w; x++) covered[y * size + x] = 1;
            }
            free -= area;
            unusedArea -= area;
            used[ci] = 1;

            dfs();

            used[ci] = 0;
            unusedArea += area;
            free += area;
            for (let y = ry; y < ry + h; y++) {
              for (let x = rx; x < rx + w; x++) covered[y * size + x] = 0;
            }
            if (count >= limit) return;
          }
        }
      }
    }
  };

  dfs();
  return count;
}

/* ------------------------------------------------------------------ */
/* Generation                                                          */
/* ------------------------------------------------------------------ */

const ATTEMPTS = 40;

export function generatePuzzle(
  seed: string,
  difficulty: Difficulty = "medium",
): PatchesPuzzle {
  const settings = SETTINGS[difficulty] ?? SETTINGS.medium;
  let best: PatchesPuzzle | null = null;

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const rng = mulberry32(hashSeed(`${seed}|patches|${difficulty}|${attempt}`));
    const rects = tileBoard(settings.size, settings.patches, settings.maxArea, rng);
    if (!rects) continue;

    const clues: PatchClue[] = rects.map((rect) => ({ ...rect, area: areaOf(rect) }));
    const puzzle: PatchesPuzzle = {
      id: `${difficulty}:${seed}`,
      size: settings.size,
      difficulty,
      clues,
      solution: clues,
      solutionCount: 0,
    };

    const solutionCount = countSolutions(puzzle, 2);
    if (solutionCount === 0) continue;
    puzzle.solutionCount = solutionCount;

    if (solutionCount === 1) return puzzle;
    if (!best || solutionCount < best.solutionCount) best = puzzle;
  }

  if (best) return best;
  throw new Error(`Patches: could not generate a "${difficulty}" puzzle for "${seed}"`);
}

/* ------------------------------------------------------------------ */
/* Helpers used by the board                                           */
/* ------------------------------------------------------------------ */

export function clueAt(puzzle: PatchesPuzzle, cell: number): PatchClue | null {
  const x = cell % puzzle.size;
  const y = Math.floor(cell / puzzle.size);
  return (
    puzzle.clues.find(
      (clue) => x >= clue.x && x < clue.x + clue.w && y >= clue.y && y < clue.y + clue.h,
    ) ?? null
  );
}

export function normalizeRect(a: number, b: number, size: number): Rect {
  const ax = a % size;
  const ay = Math.floor(a / size);
  const bx = b % size;
  const by = Math.floor(b / size);
  const x = Math.min(ax, bx);
  const y = Math.min(ay, by);
  return {
    x,
    y,
    w: Math.abs(ax - bx) + 1,
    h: Math.abs(ay - by) + 1,
  };
}

export function rectCellCount(rect: Rect): number {
  return rect.w * rect.h;
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function rectContains(rect: Rect, clue: PatchClue): boolean {
  return clue.x >= rect.x && clue.x < rect.x + rect.w && clue.y >= rect.y && clue.y < rect.y + rect.h;
}

/** Clues fully inside a rectangle. */
export function cluesInside(puzzle: PatchesPuzzle, rect: Rect): PatchClue[] {
  return puzzle.clues.filter((clue) => rectContains(rect, clue));
}

/** Area covered by the placed patches. */
export function coveredArea(patches: readonly PlacedPatch[]): number {
  return patches.reduce((total, patch) => total + patch.w * patch.h, 0);
}

export function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
