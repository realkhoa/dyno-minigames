/**
 * Tango puzzle engine.
 *
 * Rules (the daily "Tango" format):
 *  - 6x6 grid. Every cell holds a sun (1) or a moon (2).
 *  - Each row and each column contains exactly three suns and three moons.
 *  - Never three identical symbols in a row/column.
 *  - Some cells are pre-filled.
 *  - Some adjacent pairs are linked: "=" means the pair must match,
 *    "x" means the pair must differ.
 *
 * Difficulty is defined by how many valid completions a puzzle has:
 * easy accepts many, deadly is guaranteed to have exactly one.
 */

export type Sym = 0 | 1 | 2;
export type Difficulty = "easy" | "medium" | "hard" | "deadly";
export type RelationKind = "same" | "diff";

export interface Relation {
  a: number;
  b: number;
  kind: RelationKind;
}

export interface TangoPuzzle {
  id: string;
  size: number;
  difficulty: Difficulty;
  givens: Sym[];
  relations: Relation[];
  solution: Sym[];
  /** Exact number of valid completions (capped during generation). */
  solutionCount: number;
}

export const SUN = 1;
export const MOON = 2;
export const EMPTY = 0;

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "deadly"];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  deadly: "Deadly",
};

interface DifficultySpec {
  relations: number;
  minSolutions: number;
  maxSolutions: number;
  minGivens: number;
}

/**
 * Solution-count bands. Higher difficulty => strictly fewer valid grids.
 * deadly: exactly one solution.
 */
const DIFFICULTY_SETTINGS: Record<Difficulty, DifficultySpec> = {
  easy: { relations: 3, minSolutions: 6, maxSolutions: 14, minGivens: 4 },
  medium: { relations: 5, minSolutions: 4, maxSolutions: 5, minGivens: 4 },
  hard: { relations: 7, minSolutions: 2, maxSolutions: 3, minGivens: 3 },
  deadly: { relations: 9, minSolutions: 1, maxSolutions: 1, minGivens: 3 },
};

/* ------------------------------------------------------------------ */
/* Random                                                              */
/* ------------------------------------------------------------------ */

export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Constraint helpers                                                  */
/* ------------------------------------------------------------------ */

function satisfied(kind: RelationKind, a: Sym, b: Sym): boolean {
  return kind === "same" ? a === b : a !== b;
}

function tripleAt(cells: Sym[], size: number, i: number): boolean {
  const v = cells[i];
  if (v === EMPTY) return false;
  const r = Math.floor(i / size);
  const c = i % size;

  for (let start = c - 2; start <= c; start++) {
    if (start < 0 || start + 2 >= size) continue;
    const j = r * size + start;
    if (cells[j] === v && cells[j + 1] === v && cells[j + 2] === v) return true;
  }
  for (let start = r - 2; start <= r; start++) {
    if (start < 0 || start + 2 >= size) continue;
    const j = start * size + c;
    if (cells[j] === v && cells[j + size] === v && cells[j + 2 * size] === v) {
      return true;
    }
  }
  return false;
}

/** Count solutions, stopping as soon as `limit` is reached. */
export function countSolutions(
  size: number,
  givens: readonly Sym[],
  relations: readonly Relation[],
  limit = 2,
): number {
  const half = size / 2;
  const cells = givens.slice() as Sym[];
  const rowCount: number[][] = Array.from({ length: size }, () => [0, 0, 0]);
  const colCount: number[][] = Array.from({ length: size }, () => [0, 0, 0]);
  const relByCell: number[][] = Array.from({ length: size * size }, () => []);

  const empties: number[] = [];
  for (let i = 0; i < size * size; i++) {
    const r = Math.floor(i / size);
    const c = i % size;
    const v = cells[i];
    if (v === EMPTY) empties.push(i);
    else {
      if (v !== SUN && v !== MOON) return 0;
      rowCount[r][v] += 1;
      colCount[c][v] += 1;
    }
  }
  for (let ri = 0; ri < relations.length; ri++) {
    const rel = relations[ri];
    relByCell[rel.a].push(ri);
    relByCell[rel.b].push(ri);
  }
  for (let r = 0; r < size; r++) {
    if (rowCount[r][SUN] > half || rowCount[r][MOON] > half) return 0;
  }
  for (let c = 0; c < size; c++) {
    if (colCount[c][SUN] > half || colCount[c][MOON] > half) return 0;
  }
  for (let c = 0; c < size; c++) {
    for (let r = 0; r < size; r++) {
      if (tripleAt(cells, size, r * size + c)) return 0;
    }
  }

  let solutions = 0;

  const dfs = (k: number): void => {
    if (solutions >= limit) return;
    if (k === empties.length) {
      solutions += 1;
      return;
    }
    const i = empties[k];
    const r = Math.floor(i / size);
    const c = i % size;

    for (let v = SUN as number; v <= MOON; v++) {
      if (rowCount[r][v] >= half || colCount[c][v] >= half) continue;

      cells[i] = v as Sym;
      if (tripleAt(cells, size, i)) {
        cells[i] = EMPTY;
        continue;
      }

      let ok = true;
      for (const ri of relByCell[i]) {
        const rel = relations[ri];
        const other = rel.a === i ? rel.b : rel.a;
        const ov = cells[other];
        if (ov !== EMPTY && !satisfied(rel.kind, v as Sym, ov)) {
          ok = false;
          break;
        }
      }
      if (!ok) {
        cells[i] = EMPTY;
        continue;
      }

      rowCount[r][v] += 1;
      colCount[c][v] += 1;
      dfs(k + 1);
      rowCount[r][v] -= 1;
      colCount[c][v] -= 1;
      cells[i] = EMPTY;
      if (solutions >= limit) return;
    }
  };

  dfs(0);
  return solutions;
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export function isSolved(
  size: number,
  cells: readonly Sym[],
  relations: readonly Relation[],
): boolean {
  const half = size / 2;
  for (let i = 0; i < size * size; i++) {
    if (cells[i] === EMPTY) return false;
  }
  const rowCount: number[][] = Array.from({ length: size }, () => [0, 0, 0]);
  const colCount: number[][] = Array.from({ length: size }, () => [0, 0, 0]);
  for (let i = 0; i < size * size; i++) {
    const r = Math.floor(i / size);
    const c = i % size;
    const v = cells[i];
    rowCount[r][v] += 1;
    colCount[c][v] += 1;
    if (tripleAt(cells as Sym[], size, i)) return false;
  }
  for (let r = 0; r < size; r++) {
    if (rowCount[r][SUN] !== half || rowCount[r][MOON] !== half) return false;
  }
  for (let c = 0; c < size; c++) {
    if (colCount[c][SUN] !== half || colCount[c][MOON] !== half) return false;
  }
  for (const rel of relations) {
    if (!satisfied(rel.kind, cells[rel.a], cells[rel.b])) return false;
  }
  return true;
}

/** Cells that currently break a rule (for live feedback while playing). */
export function findConflicts(
  size: number,
  cells: readonly Sym[],
  relations: readonly Relation[],
): Set<number> {
  const bad = new Set<number>();
  const half = size / 2;

  const markTriples = (indices: number[]) => {
    for (let k = 0; k + 2 < indices.length; k++) {
      const a = indices[k];
      const b = indices[k + 1];
      const c = indices[k + 2];
      const v = cells[a];
      if (v !== EMPTY && cells[b] === v && cells[c] === v) {
        bad.add(a);
        bad.add(b);
        bad.add(c);
      }
    }
  };

  for (let r = 0; r < size; r++) {
    const row: number[] = [];
    for (let c = 0; c < size; c++) row.push(r * size + c);
    markTriples(row);
    for (const v of [SUN, MOON]) {
      const matching = row.filter((i) => cells[i] === v);
      if (matching.length > half) matching.forEach((i) => bad.add(i));
    }
  }
  for (let c = 0; c < size; c++) {
    const col: number[] = [];
    for (let r = 0; r < size; r++) col.push(r * size + c);
    markTriples(col);
    for (const v of [SUN, MOON]) {
      const matching = col.filter((i) => cells[i] === v);
      if (matching.length > half) matching.forEach((i) => bad.add(i));
    }
  }
  for (const rel of relations) {
    const a = cells[rel.a];
    const b = cells[rel.b];
    if (a !== EMPTY && b !== EMPTY && !satisfied(rel.kind, a, b)) {
      bad.add(rel.a);
      bad.add(rel.b);
    }
  }
  return bad;
}

/* ------------------------------------------------------------------ */
/* Generation                                                          */
/* ------------------------------------------------------------------ */

function randomSolution(size: number, rng: () => number): Sym[] {
  const half = size / 2;
  const cells = new Array<Sym>(size * size).fill(EMPTY);
  const rowCount: number[][] = Array.from({ length: size }, () => [0, 0, 0]);
  const colCount: number[][] = Array.from({ length: size }, () => [0, 0, 0]);

  const dfs = (i: number): boolean => {
    if (i === size * size) return true;
    const r = Math.floor(i / size);
    const c = i % size;
    const order = rng() < 0.5 ? [SUN, MOON] : [MOON, SUN];
    for (const v of order) {
      if (rowCount[r][v] >= half || colCount[c][v] >= half) continue;
      cells[i] = v as Sym;
      if (tripleAt(cells, size, i)) {
        cells[i] = EMPTY;
        continue;
      }
      rowCount[r][v] += 1;
      colCount[c][v] += 1;
      if (dfs(i + 1)) return true;
      rowCount[r][v] -= 1;
      colCount[c][v] -= 1;
      cells[i] = EMPTY;
    }
    return false;
  };

  if (!dfs(0)) throw new Error("Tango: could not build a full grid");
  return cells;
}

function pickRelations(
  size: number,
  solution: readonly Sym[],
  rng: () => number,
  count: number,
): Relation[] {
  const pairs: Array<{ a: number; b: number }> = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const i = r * size + c;
      if (c + 1 < size) pairs.push({ a: i, b: i + 1 });
      if (r + 1 < size) pairs.push({ a: i, b: i + size });
    }
  }
  return shuffle(pairs, rng)
    .slice(0, count)
    .map(({ a, b }) => ({
      a,
      b,
      kind: solution[a] === solution[b] ? "same" : "diff",
    }));
}

/**
 * Remove clues one at a time. A removal is kept only while the number of
 * valid completions stays within the difficulty band, so every puzzle ends
 * with a known, bounded solution count.
 */
function carveClues(
  size: number,
  solution: readonly Sym[],
  relations: readonly Relation[],
  spec: DifficultySpec,
  rng: () => number,
): Sym[] {
  const givens = solution.slice() as Sym[];
  const order = shuffle(
    Array.from({ length: size * size }, (_, i) => i),
    rng,
  );
  const limit = spec.maxSolutions + 1;
  let clues = size * size;

  for (const i of order) {
    if (clues <= spec.minGivens) break;
    const previous = givens[i];
    givens[i] = EMPTY;
    const count = countSolutions(size, givens, relations, limit);
    if (count <= spec.maxSolutions) {
      clues -= 1;
    } else {
      givens[i] = previous;
    }
  }
  return givens;
}

export function generatePuzzle(
  seed: string,
  difficulty: Difficulty = "medium",
  size = 6,
): TangoPuzzle {
  const spec = DIFFICULTY_SETTINGS[difficulty] ?? DIFFICULTY_SETTINGS.medium;
  const limit = spec.maxSolutions + 1;

  for (let attempt = 0; attempt < 80; attempt++) {
    const rng = mulberry32(hashSeed(`${seed}|${difficulty}|${attempt}`));
    const solution = randomSolution(size, rng);
    // Fewer links => a larger solution space, so nudge the link count on retries.
    const relationCount = Math.max(2, spec.relations + [0, -2, 2][attempt % 3]);
    const relations = pickRelations(size, solution, rng, relationCount);
    const givens = carveClues(size, solution, relations, spec, rng);
    const solutionCount = countSolutions(size, givens, relations, limit);

    if (solutionCount >= spec.minSolutions && solutionCount <= spec.maxSolutions) {
      return {
        id: `${difficulty}:${seed}`,
        size,
        difficulty,
        givens,
        relations,
        solution,
        solutionCount,
      };
    }
  }

  throw new Error(`Tango: could not generate a "${difficulty}" puzzle for "${seed}"`);
}

export function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
