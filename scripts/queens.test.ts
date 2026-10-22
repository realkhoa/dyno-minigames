import {
  DIFFICULTIES,
  DIFFICULTY_SIZES,
  countSolutions,
  generatePuzzle,
  isSolved,
  type Difficulty,
} from "../src/games/queens/engine.ts";

function renderRegions(regions: number[], size: number): string {
  const glyph = "abcdefghijklmnopqrstuvwxyz";
  const lines: string[] = [];
  for (let r = 0; r < size; r++) {
    lines.push(
      regions
        .slice(r * size, r * size + size)
        .map((id) => glyph[id])
        .join(" "),
    );
  }
  return lines.join("\n");
}

function orth(size: number, index: number): number[] {
  const r = Math.floor(index / size);
  const c = index % size;
  const out: number[] = [];
  if (r > 0) out.push(index - size);
  if (r < size - 1) out.push(index + size);
  if (c > 0) out.push(index - 1);
  if (c < size - 1) out.push(index + 1);
  return out;
}

function regionsConnected(regions: number[], size: number): boolean {
  for (let region = 0; region < size; region++) {
    const cells = regions
      .map((value, index) => (value === region ? index : -1))
      .filter((index) => index >= 0);
    if (cells.length === 0) return false;
    const seen = new Set<number>([cells[0]]);
    const stack = [cells[0]];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const neighbor of orth(size, current)) {
        if (regions[neighbor] === region && !seen.has(neighbor)) {
          seen.add(neighbor);
          stack.push(neighbor);
        }
      }
    }
    if (seen.size !== cells.length) return false;
  }
  return true;
}

let failures = 0;

for (const difficulty of DIFFICULTIES) {
  const started = performance.now();
  const runs = 20;
  const counts: number[] = [];
  const tight: number[] = [];

  for (let i = 0; i < runs; i++) {
    const puzzle = generatePuzzle(`test-${difficulty}-${i}`, difficulty as Difficulty);
    counts.push(puzzle.solutionCount);
    if (puzzle.solutionCount <= 3) tight.push(puzzle.solutionCount);

    const queens = new Array<boolean>(puzzle.size * puzzle.size).fill(false);
    for (let row = 0; row < puzzle.size; row++) {
      queens[row * puzzle.size + puzzle.solution[row]] = true;
    }
    if (!isSolved(puzzle.size, puzzle.regions, queens)) {
      failures++;
      console.error(`  ! reference placement invalid (${difficulty} #${i})`);
    }
    if (!regionsConnected(puzzle.regions, puzzle.size)) {
      failures++;
      console.error(`  ! regions not connected (${difficulty} #${i})`);
    }

    const exact = countSolutions(puzzle.size, puzzle.regions, puzzle.solutionCount + 1);
    if (exact !== puzzle.solutionCount) {
      failures++;
      console.error(
        `  ! reported count ${puzzle.solutionCount} vs ${exact} (${difficulty} #${i})`,
      );
    }
  }

  const elapsed = performance.now() - started;
  const avg = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1);
  console.log(
    `${difficulty.padEnd(6)} n=${DIFFICULTY_SIZES[difficulty as Difficulty]} ` +
      `${runs} puzzles in ${elapsed.toFixed(0)}ms (${(elapsed / runs).toFixed(1)}ms each) · ` +
      `solutions ${Math.min(...counts)}-${Math.max(...counts)} (avg ${avg(counts)}) · ` +
      `≤3 solutions: ${tight.length}/${runs}`,
  );
}

const a = generatePuzzle("determinism", "hard");
const b = generatePuzzle("determinism", "hard");
if (a.regions.join() !== b.regions.join()) {
  failures++;
  console.error("! generation is not deterministic");
}

const sample = generatePuzzle("sample", "medium");
console.log(`\nSample medium: ${sample.size}x${sample.size}, solutions=${sample.solutionCount}`);
console.log(renderRegions(sample.regions, sample.size));
console.log("solution columns:", sample.solution.join(","));

if (failures > 0) {
  console.error(`\nFAILED: ${failures} problem(s)`);
  process.exit(1);
}
console.log("\nAll checks passed.");
