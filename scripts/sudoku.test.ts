import {
  DIFFICULTIES,
  SIZE,
  countSolutions,
  findConflicts,
  generatePuzzle,
  isSolved,
  type Difficulty,
} from "../src/games/sudoku/engine.ts";

function render(cells: number[]): string {
  const lines: string[] = [];
  for (let row = 0; row < SIZE; row++) {
    const parts: string[] = [];
    for (let col = 0; col < SIZE; col++) {
      parts.push(String(cells[row * SIZE + col] || "."));
      if (col % 3 === 2 && col < SIZE - 1) parts.push("|");
    }
    lines.push(parts.join(" "));
    if (row % 2 === 1 && row < SIZE - 1) lines.push("------+------");
  }
  return lines.join("\n");
}

let failures = 0;

for (const difficulty of DIFFICULTIES) {
  const started = performance.now();
  const runs = 25;
  const clues: number[] = [];
  const times: number[] = [];

  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    const puzzle = generatePuzzle(`test-${difficulty}-${i}`, difficulty as Difficulty);
    times.push(performance.now() - t0);

    const clueCount = puzzle.givens.filter(Boolean).length;
    clues.push(clueCount);
    if (!isSolved(puzzle.solution)) {
      failures++;
      console.error(`  ! solution invalid (${difficulty} #${i})`);
    }
    if (countSolutions(puzzle.givens, 2) !== 1) {
      failures++;
      console.error(`  ! puzzle not unique (${difficulty} #${i})`);
    }
    for (let c = 0; c < SIZE * SIZE; c++) {
      if (puzzle.givens[c] && puzzle.givens[c] !== puzzle.solution[c]) {
        failures++;
        console.error(`  ! given mismatch (${difficulty} #${i})`);
        break;
      }
    }
    if (isSolved(puzzle.givens)) {
      failures++;
      console.error(`  ! puzzle already solved (${difficulty} #${i})`);
    }
  }

  const elapsed = performance.now() - started;
  const avg = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1);
  console.log(
    `${difficulty.padEnd(6)} ${runs} puzzles in ${elapsed.toFixed(0)}ms ` +
      `(${avg(times)}ms each) · clues ${Math.min(...clues)}-${Math.max(...clues)} (avg ${avg(clues)})`,
  );
}

// Conflict detection sanity check.
const bad = new Array<number>(SIZE * SIZE).fill(0);
bad[0] = 3;
bad[1] = 3;
if (findConflicts(bad).size !== 2) {
  failures++;
  console.error("! conflict detection failed for a duplicated row value");
}

const sample = generatePuzzle("sample", "medium");
console.log(`\nSample medium (${sample.givens.filter(Boolean).length} clues):`);
console.log(render(sample.givens));
console.log("\nSolution:");
console.log(render(sample.solution));

if (failures > 0) {
  console.error(`\nFAILED: ${failures} problem(s)`);
  process.exit(1);
}
console.log("\nAll checks passed.");
