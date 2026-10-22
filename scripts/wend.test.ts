import {
  DIFFICULTIES,
  areAdjacent,
  generatePuzzle,
  isSolved,
  isWord,
  pathToWord,
  type Difficulty,
} from "../src/games/wend/engine.ts";
import { WEND_WORDS } from "../src/games/wend/words.ts";

function render(puzzle: ReturnType<typeof generatePuzzle>): string {
  const lines: string[] = [];
  for (let row = 0; row < puzzle.size; row++) {
    lines.push(
      puzzle.grid
        .slice(row * puzzle.size, row * puzzle.size + puzzle.size)
        .join(" "),
    );
  }
  return lines.join("\n");
}

let failures = 0;

console.log(`dictionary: ${WEND_WORDS.length} words, sample ${WEND_WORDS.slice(0, 6).join(", ")}`);

for (const difficulty of DIFFICULTIES) {
  const started = performance.now();
  const runs = 20;
  const times: number[] = [];

  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    const puzzle = generatePuzzle(`test-${difficulty}-${i}`, difficulty as Difficulty);
    times.push(performance.now() - t0);
    const total = puzzle.size * puzzle.size;

    const covered = new Set<number>();
    const usedWords = new Set<string>();

    if (puzzle.lengths.reduce((a, b) => a + b, 0) !== total) {
      failures++;
      console.error(`  ! lengths do not cover the board (${difficulty} #${i})`);
    }
    if (puzzle.solution.length !== puzzle.lengths.length) {
      failures++;
      console.error(`  ! solution/slot mismatch (${difficulty} #${i})`);
    }

    for (const [index, entry] of puzzle.solution.entries()) {
      if (entry.cells.length !== puzzle.lengths[index]) {
        failures++;
        console.error(`  ! slot length mismatch (${difficulty} #${i})`);
      }
      if (!isWord(entry.word)) {
        failures++;
        console.error(`  ! "${entry.word}" is not in the dictionary`);
      }
      if (usedWords.has(entry.word)) {
        failures++;
        console.error(`  ! repeated word "${entry.word}"`);
      }
      usedWords.add(entry.word);

      for (const cell of entry.cells) {
        if (covered.has(cell)) {
          failures++;
          console.error(`  ! overlapping cell (${difficulty} #${i})`);
        }
        covered.add(cell);
      }
      for (let k = 1; k < entry.cells.length; k++) {
        if (!areAdjacent(puzzle.size, entry.cells[k - 1], entry.cells[k])) {
          failures++;
          console.error(`  ! word path is not continuous (${difficulty} #${i})`);
        }
      }
      if (pathToWord(puzzle.grid, entry.cells) !== entry.word) {
        failures++;
        console.error(`  ! grid letters do not spell "${entry.word}" (${difficulty} #${i})`);
      }
    }

    if (covered.size !== total) {
      failures++;
      console.error(`  ! board not fully covered (${difficulty} #${i})`);
    }
    if (puzzle.grid.some((letter) => !/^[A-Z]$/.test(letter))) {
      failures++;
      console.error(`  ! empty grid cell (${difficulty} #${i})`);
    }
    if (!isSolved(puzzle.lengths, puzzle.solution)) {
      failures++;
      console.error(`  ! solved check failed (${difficulty} #${i})`);
    }
  }

  const elapsed = performance.now() - started;
  const avg = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1);
  console.log(
    `${difficulty.padEnd(6)} ${runs} boards in ${elapsed.toFixed(0)}ms (${avg(times)}ms each)`,
  );
}

const a = generatePuzzle("determinism", "hard");
const b = generatePuzzle("determinism", "hard");
if (a.grid.join("") !== b.grid.join("")) {
  failures++;
  console.error("! generation is not deterministic");
}

console.log("\nSample easy board:");
console.log(render(generatePuzzle("sample", "easy")));

if (failures > 0) {
  console.error(`\nFAILED: ${failures} problem(s)`);
  process.exit(1);
}
console.log("\nAll checks passed.");
