import { hashSeed } from "../../lib/random.ts";
import { PINPOINT_CATEGORIES, type PinpointCategory } from "./categories.ts";

export interface SelectedPinpoint {
  category: PinpointCategory;
  id: string;
}

/** Lowercase, strip accents and punctuation, collapse spaces, drop "the". */
export function normalizeGuess(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^the /, "");
}

function variants(text: string): string[] {
  const base = normalizeGuess(text);
  if (!base) return [];
  const out = new Set([base]);
  if (base.endsWith("s")) out.add(base.slice(0, -1));
  else out.add(`${base}s`);
  return [...out];
}

export function matchesCategory(category: PinpointCategory, guess: string): boolean {
  const guesses = variants(guess);
  if (guesses.length === 0) return false;
  return [category.answer, ...category.aliases].some((answer) =>
    variants(answer).some((variant) => guesses.includes(variant)),
  );
}

export function categoryForSeed(seed: string, prefix: string): SelectedPinpoint {
  const index = hashSeed(seed) % PINPOINT_CATEGORIES.length;
  return { category: PINPOINT_CATEGORIES[index], id: `${prefix}:${seed}` };
}

export function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
