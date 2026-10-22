/**
 * Wend puzzle engine.
 *
 * Rules:
 *  - Every letter on the board belongs to exactly one hidden word.
 *  - Words are traced along orthogonally adjacent cells.
 *  - The lengths of the hidden words are given.
 *  - Words never overlap and no letter is left over.
 */

import { hashSeed, mulberry32, shuffle } from "../../lib/random.ts";
import { neighbors, randomPath } from "../../lib/grid.ts";
import { WEND_WORD_SET, WEND_WORDS } from "./words.ts";

export type Difficulty = "easy" | "medium" | "hard" | "deadly";

export interface WendWord {
  word: string;
  cells: number[];
}

export interface WendPuzzle {
  id: string;
  size: number;
  difficulty: Difficulty;
  /** Lengths of the hidden words, in slot order. */
  lengths: number[];
  /** Uppercase letters per cell. */
  grid: string[];
  solution: WendWord[];
}

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "deadly"];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  deadly: "Deadly",
};

const SETTINGS: Record<Difficulty, { size: number; lengths: number[] }> = {
  easy: { size: 5, lengths: [4, 5, 5, 5, 6] },
  medium: { size: 6, lengths: [5, 5, 6, 6, 7, 7] },
  hard: { size: 6, lengths: [6, 6, 8, 8, 8] },
  deadly: { size: 7, lengths: [5, 6, 7, 7, 8, 8, 8] },
};

const BY_LENGTH = new Map<number, string[]>();
for (const word of WEND_WORDS) {
  const list = BY_LENGTH.get(word.length);
  if (list) list.push(word);
  else BY_LENGTH.set(word.length, [word]);
}

export function isWord(word: string): boolean {
  return WEND_WORD_SET.has(word.toLowerCase());
}

export function pathToWord(grid: readonly string[], cells: readonly number[]): string {
  return cells.map((cell) => grid[cell] ?? "").join("").toLowerCase();
}

const areAdjacent = (size: number, a: number, b: number) => {
  const ra = Math.floor(a / size);
  const ca = a % size;
  const rb = Math.floor(b / size);
  const cb = b % size;
  return Math.abs(ra - rb) + Math.abs(ca - cb) === 1;
};

export function generatePuzzle(seed: string, difficulty: Difficulty = "medium"): WendPuzzle {
  const settings = SETTINGS[difficulty] ?? SETTINGS.medium;
  const size = settings.size;
  const total = size * size;

  for (let attempt = 0; attempt < 40; attempt++) {
    const rng = mulberry32(hashSeed(`${seed}|wend|${difficulty}|${attempt}`));
    const path = randomPath(size, rng);
    if (!path) continue;

    const lengths = shuffle(settings.lengths, rng);
    const segments: number[][] = [];
    let offset = 0;
    for (const length of lengths) {
      segments.push(path.slice(offset, offset + length));
      offset += length;
    }
    if (offset !== total) continue;

    const used = new Set<string>();
    const words: WendWord[] = [];
    let ok = true;

    for (const cells of segments) {
      const pool = BY_LENGTH.get(cells.length) ?? [];
      let chosen: string | null = null;
      for (let tries = 0; tries < 40; tries++) {
        const candidate = pool[Math.floor(rng() * pool.length)];
        if (candidate && !used.has(candidate)) {
          chosen = candidate;
          break;
        }
      }
      if (!chosen) {
        ok = false;
        break;
      }
      used.add(chosen);
      words.push({ word: chosen, cells });
    }
    if (!ok) continue;

    const grid = new Array<string>(total).fill("");
    for (const entry of words) {
      entry.cells.forEach((cell, index) => {
        grid[cell] = entry.word[index].toUpperCase();
      });
    }
    if (grid.some((letter) => letter === "")) continue;

    return {
      id: `${difficulty}:${seed}`,
      size,
      difficulty,
      lengths: segments.map((cells) => cells.length),
      grid,
      solution: words,
    };
  }

  throw new Error(`Wend: could not generate a "${difficulty}" puzzle for "${seed}"`);
}

/** Index of the first empty slot with this length, or -1. */
export function openSlot(
  lengths: readonly number[],
  filled: ReadonlyArray<WendWord | null>,
  length: number,
): number {
  return lengths.findIndex((value, index) => value === length && filled[index] === null);
}

export function isSolved(
  lengths: readonly number[],
  filled: ReadonlyArray<WendWord | null>,
): boolean {
  return lengths.every((_, index) => filled[index] !== null);
}

export function usedCells(filled: ReadonlyArray<WendWord | null>): Set<number> {
  const cells = new Set<number>();
  for (const entry of filled) {
    if (!entry) continue;
    for (const cell of entry.cells) cells.add(cell);
  }
  return cells;
}

export { areAdjacent, neighbors };

export function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
