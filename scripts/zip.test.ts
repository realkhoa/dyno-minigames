import {
  DIFFICULTIES,
  areAdjacent,
  generatePuzzle,
  isSolved,
  nextNumber,
  type Difficulty,
} from "../src/games/zip/engine.ts";

function render(size: number, path: number[], numberCells: Map<number, number>): string {
  const lines: string[] = [];
  for (let row = 0; row < size; row++) {
    const parts: string[] = [];
    for (let col = 0; col < size; col++) {
      const index = row * size + col;
      const step = path.indexOf(index);
      const number = numberCells.get(index);
      parts.push(number ? String(number).padStart(2, " ") : step >= 0 ? " ." : "  ");
    }
    lines.push(parts.join(" "));
  }
  return lines.join("\n");
}

let failures = 0;

for (const difficulty of DIFFICULTIES) {
  const started = performance.now();
  const runs = 25;
  const times: number[] = [];
  const counts: number[] = [];

  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    const puzzle = generatePuzzle(`test-${difficulty}-${i}`, difficulty as Difficulty);
    times.push(performance.now() - t0);

    const total = puzzle.size * puzzle.size;
    if (puzzle.solution.length !== total) {
      failures++;
      console.error(`  ! path length ${puzzle.solution.length} != ${total} (${difficulty} #${i})`);
    }
    if (new Set(puzzle.solution).size !== total) {
      failures++;
      console.error(`  ! path revisits a cell (${difficulty} #${i})`);
    }
    for (let k = 1; k < puzzle.solution.length; k++) {
      if (!areAdjacent(puzzle.size, puzzle.solution[k - 1], puzzle.solution[k])) {
        failures++;
        console.error(`  ! path is not continuous (${difficulty} #${i})`);
        break;
      }
    }
    if (!isSolved(puzzle.size, puzzle.numbers, puzzle.solution)) {
      failures++;
      console.error(`  ! stored solution rejected (${difficulty} #${i})`);
    }
    if (puzzle.numbers[0].value !== 1) {
      failures++;
      console.error(`  ! numbers not starting at 1 (${difficulty} #${i})`);
    }
    if (puzzle.numbers[puzzle.numbers.length - 1].index !==
        puzzle.solution[puzzle.solution.length - 1]) {
      failures++;
      console.error(`  ! last number is not the end of the path (${difficulty} #${i})`);
    }
    counts.push(puzzle.numbers.length);

    // A path that drops the final number must not be accepted.
    if (isSolved(puzzle.size, puzzle.numbers, puzzle.solution.slice(0, -1))) {
      failures++;
      console.error(`  ! truncated path accepted (${difficulty} #${i})`);
    }
    const next = nextNumber(puzzle.solution.slice(0, 5), puzzle.numbers);
    if (!next) {
      failures++;
      console.error(`  ! next number missing (${difficulty} #${i})`);
    }
  }

  const elapsed = performance.now() - started;
  const avg = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1);
  console.log(
    `${difficulty.padEnd(6)} ${runs} puzzles in ${elapsed.toFixed(0)}ms ` +
      `(${avg(times)}ms each) · numbers ${Math.min(...counts)}-${Math.max(...counts)}`,
  );
}

const a = generatePuzzle("determinism", "hard");
const b = generatePuzzle("determinism", "hard");
if (a.solution.join() !== b.solution.join()) {
  failures++;
  console.error("! generation is not deterministic");
}

const sample = generatePuzzle("sample", "medium");
const numberCells = new Map(sample.numbers.map((n) => [n.index, n.value]));
console.log(`\nSample medium (${sample.size}x${sample.size}):`);
console.log(render(sample.size, sample.solution, numberCells));

if (failures > 0) {
  console.error(`\nFAILED: ${failures} problem(s)`);
  process.exit(1);
}
console.log("\nAll checks passed.");
