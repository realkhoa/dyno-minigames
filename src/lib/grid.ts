/** Shared square-grid helpers for path-based puzzles (Zip, Wend). */

import { shuffle } from "./random.ts";

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
