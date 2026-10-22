import { hashSeed } from "../../lib/random.ts";
import { CROSSCLIMB_PUZZLES, type CrossclimbPuzzle } from "./puzzles.ts";

export interface SelectedCrossclimb {
  puzzle: CrossclimbPuzzle;
  /** Stable id: daily puzzles are keyed by date, practice by seed. */
  id: string;
}

export function differsByOne(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let differences = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) differences += 1;
    if (differences > 1) return false;
  }
  return differences === 1;
}

export function isLadder(words: readonly string[]): boolean {
  if (words.length < 2) return false;
  for (let i = 1; i < words.length; i++) {
    if (!differsByOne(words[i - 1], words[i])) return false;
  }
  return true;
}

export function puzzleForSeed(seed: string, prefix: string): SelectedCrossclimb {
  const index = hashSeed(seed) % CROSSCLIMB_PUZZLES.length;
  return { puzzle: CROSSCLIMB_PUZZLES[index], id: `${prefix}:${seed}` };
}

export function isSolved(entries: readonly string[], puzzle: CrossclimbPuzzle): boolean {
  return entries.every(
    (entry, index) => entry.trim().toUpperCase() === puzzle.words[index + 1],
  );
}

export function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
