import {
  DIFFICULTIES,
  countSolutions,
  findConflicts,
  generatePuzzle,
  isSolved,
  todayKey,
  type Difficulty,
} from "../src/games/tango/engine.ts";

const givensOf = (p: ReturnType<typeof generatePuzzle>) =>
  p.givens.filter((v) => v !== 0).length;

function render(cells: readonly number[], size: number): string {
  const glyph = [".", "S", "M"];
  const lines: string[] = [];
  for (let r = 0; r < size; r++) {
    lines.push(
      cells
        .slice(r * size, r * size + size)
        .map((v) => glyph[v])
        .join(" "),
    );
  }
  return lines.join("\n");
}

let failures = 0;

for (const difficulty of DIFFICULTIES) {
  const started = performance.now();
  const counts: number[] = [];
  const relCounts: number[] = [];
  const solutions: number[] = [];
  const runs = 30;

  for (let i = 0; i < runs; i++) {
    const puzzle = generatePuzzle(`test-${difficulty}-${i}`, difficulty);
    counts.push(givensOf(puzzle));
    relCounts.push(puzzle.relations.length);
    solutions.push(puzzle.solutionCount);

    const exact = countSolutions(
      puzzle.size,
      puzzle.givens,
      puzzle.relations,
      puzzle.solutionCount + 1,
    );
    if (exact !== puzzle.solutionCount) {
      failures++;
      console.error(`  ! count mismatch (${puzzle.solutionCount} vs ${exact}) ${difficulty} #${i}`);
    }
    if (difficulty === "deadly" && exact !== 1) {
      failures++;
      console.error(`  ! deadly not unique ${difficulty} #${i}`);
    }
    if (!isSolved(puzzle.size, puzzle.solution, puzzle.relations)) {
      failures++;
      console.error(`  ! solution does not satisfy rules ${difficulty} #${i}`);
    }
    for (let c = 0; c < puzzle.size * puzzle.size; c++) {
      if (puzzle.givens[c] !== 0 && puzzle.givens[c] !== puzzle.solution[c]) {
        failures++;
        console.error(`  ! given mismatch ${difficulty} #${i}`);
        break;
      }
    }
    if (isSolved(puzzle.size, puzzle.givens, puzzle.relations)) {
      failures++;
      console.error(`  ! puzzle already solved ${difficulty} #${i}`);
    }
    if (givensOf(puzzle) < 1) {
      failures++;
      console.error(`  ! no locked cells ${difficulty} #${i}`);
    }
  }

  const elapsed = performance.now() - started;
  const avg = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1);
  console.log(
    `${difficulty.padEnd(6)} ${runs} puzzles in ${elapsed.toFixed(0)}ms ` +
      `(${(elapsed / runs).toFixed(1)}ms each) · locked ${Math.min(...counts)}-${Math.max(
        ...counts,
      )} · links ${avg(relCounts)} · solutions ${Math.min(...solutions)}-${Math.max(
        ...solutions,
      )}`,
  );
}

// Determinism: same seed must produce the same puzzle.
const a = generatePuzzle("determinism", "hard");
const b = generatePuzzle("determinism", "hard");
if (a.solution.join() !== b.solution.join() || a.givens.join() !== b.givens.join()) {
  failures++;
  console.error("! generation is not deterministic");
}

const sample = generatePuzzle(todayKey(), "deadly");
console.log("\nDaily deadly sample:", sample.id, `locked=${givensOf(sample)}`, `solutions=${sample.solutionCount}`);
console.log(render(sample.givens, sample.size));
console.log("\nSolution:");
console.log(render(sample.solution, sample.size));

const conflicts = findConflicts(
  sample.size,
  [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [],
);
if (conflicts.size !== 3) {
  failures++;
  console.error("! expected 3 conflicting cells for a triple, got", conflicts.size);
}

if (failures > 0) {
  console.error(`\nFAILED: ${failures} problem(s)`);
  process.exit(1);
}
console.log("\nAll checks passed.");
