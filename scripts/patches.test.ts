import {
  DIFFICULTIES,
  cluesInside,
  generatePuzzle,
  overlaps,
  type Difficulty,
} from "../src/games/patches/engine.ts";

function render(puzzle: ReturnType<typeof generatePuzzle>): string {
  const size = puzzle.size;
  const grid: string[][] = Array.from({ length: size }, () =>
    new Array<string>(size).fill("·"),
  );
  puzzle.clues.forEach((clue, index) => {
    for (let y = clue.y; y < clue.y + clue.h; y++) {
      for (let x = clue.x; x < clue.x + clue.w; x++) {
        grid[y][x] = String.fromCharCode(65 + index);
      }
    }
    grid[clue.y][clue.x] = String(clue.area);
  });
  return grid.map((row) => row.join(" ")).join("\n");
}

let failures = 0;

for (const difficulty of DIFFICULTIES) {
  const started = performance.now();
  const runs = 25;
  const counts: number[] = [];
  const times: number[] = [];

  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    const puzzle = generatePuzzle(`test-${difficulty}-${i}`, difficulty as Difficulty);
    times.push(performance.now() - t0);
    const size = puzzle.size;

    if (puzzle.clues.length !== puzzle.solution.length) {
      failures++;
      console.error(`  ! clue/solution mismatch (${difficulty} #${i})`);
    }
    counts.push(puzzle.clues.length);

    const cover = new Array<number>(size * size).fill(0);
    for (const clue of puzzle.clues) {
      if (clue.area !== clue.w * clue.h) {
        failures++;
        console.error(`  ! area mismatch (${difficulty} #${i})`);
      }
      if (clue.area < 2) {
        failures++;
        console.error(`  ! too-small patch (${difficulty} #${i})`);
      }
      if (
        clue.x < 0 ||
        clue.y < 0 ||
        clue.x + clue.w > size ||
        clue.y + clue.h > size
      ) {
        failures++;
        console.error(`  ! patch outside board (${difficulty} #${i})`);
      }
      for (let y = clue.y; y < clue.y + clue.h; y++) {
        for (let x = clue.x; x < clue.x + clue.w; x++) {
          cover[y * size + x] += 1;
        }
      }
      if (cluesInside(puzzle, clue).length !== 1) {
        failures++;
        console.error(`  ! patch does not hold exactly one clue (${difficulty} #${i})`);
      }
    }
    if (cover.some((n) => n !== 1)) {
      failures++;
      console.error(`  ! tiling does not cover the board exactly once (${difficulty} #${i})`);
    }
    for (let a = 0; a < puzzle.clues.length; a++) {
      for (let b = a + 1; b < puzzle.clues.length; b++) {
        if (overlaps(puzzle.clues[a], puzzle.clues[b])) {
          failures++;
          console.error(`  ! overlapping patches (${difficulty} #${i})`);
        }
      }
    }
  }

  const elapsed = performance.now() - started;
  const avg = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2);
  console.log(
    `${difficulty.padEnd(6)} ${runs} boards in ${elapsed.toFixed(0)}ms (${avg(times)}ms each) · ` +
      `patches ${Math.min(...counts)}-${Math.max(...counts)}`,
  );
}

const a = generatePuzzle("determinism", "hard");
const b = generatePuzzle("determinism", "hard");
if (JSON.stringify(a.clues) !== JSON.stringify(b.clues)) {
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
