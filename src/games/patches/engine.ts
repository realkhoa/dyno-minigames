/**
 * Patches puzzle engine.
 *
 * Rules:
 *  - Split the whole grid into rectangles (squares count as rectangles).
 *  - Every rectangle contains exactly one clue cell.
 *  - The clue's number is the area of its rectangle.
 *  - No overlaps and no uncovered cells.
 *
 * Boards are built by recursively cutting a rectangle, which guarantees a
 * solvable tiling; players may commit any valid tiling.
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

const SETTINGS: Record<Difficulty, { size: number; patches: number }> = {
  easy: { size: 6, patches: 12 },
  medium: { size: 7, patches: 10 },
  hard: { size: 8, patches: 9 },
  deadly: { size: 8, patches: 7 },
};

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const areaOf = (rect: Rect) => rect.w * rect.h;

function canSplit(rect: Rect): boolean {
  if (rect.w >= 2) {
    for (let cut = 1; cut < rect.w; cut++) {
      if (cut * rect.h >= 2 && (rect.w - cut) * rect.h >= 2) return true;
    }
  }
  if (rect.h >= 2) {
    for (let cut = 1; cut < rect.h; cut++) {
      if (cut * rect.w >= 2 && (rect.h - cut) * rect.w >= 2) return true;
    }
  }
  return false;
}

function splitRect(rect: Rect, rng: () => number): [Rect, Rect] {
  const cuts: Array<{ axis: "x" | "y"; at: number }> = [];
  for (let cut = 1; cut < rect.w; cut++) {
    if (cut * rect.h >= 2 && (rect.w - cut) * rect.h >= 2) {
      cuts.push({ axis: "x", at: cut });
    }
  }
  for (let cut = 1; cut < rect.h; cut++) {
    if (cut * rect.w >= 2 && (rect.h - cut) * rect.w >= 2) {
      cuts.push({ axis: "y", at: cut });
    }
  }
  const choice = cuts[Math.floor(rng() * cuts.length)];
  if (choice.axis === "x") {
    return [
      { x: rect.x, y: rect.y, w: choice.at, h: rect.h },
      { x: rect.x + choice.at, y: rect.y, w: rect.w - choice.at, h: rect.h },
    ];
  }
  return [
    { x: rect.x, y: rect.y, w: rect.w, h: choice.at },
    { x: rect.x, y: rect.y + choice.at, w: rect.w, h: rect.h - choice.at },
  ];
}

function cutIntoTiles(size: number, target: number, rng: () => number): Rect[] {
  let rects: Rect[] = [{ x: 0, y: 0, w: size, h: size }];

  while (rects.length < target) {
    const candidates = rects.filter(canSplit);
    if (candidates.length === 0) break;
    candidates.sort((a, b) => areaOf(b) - areaOf(a));
    const pool = candidates.slice(0, Math.max(1, Math.ceil(candidates.length / 2)));
    const rect = pool[Math.floor(rng() * pool.length)];
    const [first, second] = splitRect(rect, rng);
    rects = rects.filter((item) => item !== rect);
    rects.push(first, second);
  }
  return rects;
}

export function generatePuzzle(
  seed: string,
  difficulty: Difficulty = "medium",
): PatchesPuzzle {
  const settings = SETTINGS[difficulty] ?? SETTINGS.medium;
  const rng = mulberry32(hashSeed(`${seed}|patches|${difficulty}`));
  const rects = cutIntoTiles(settings.size, settings.patches, rng);

  const clues: PatchClue[] = rects.map((rect) => ({
    ...rect,
    area: areaOf(rect),
  }));

  return {
    id: `${difficulty}:${seed}`,
    size: settings.size,
    difficulty,
    clues,
    solution: clues,
  };
}

/** Clue that sits on a cell, if any. */
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
  return (
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  );
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

/** Assign each placed patch to a palette slot so neighbours differ. */
export function patchColorIndex(patches: readonly PlacedPatch[], patch: PlacedPatch): number {
  let index = 0;
  for (const other of patches) {
    if (other === patch) break;
    index += 1;
  }
  return index;
}

export function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
