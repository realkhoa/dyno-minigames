import { isLadder, differsByOne } from "../src/games/crossclimb/engine.ts";
import { CROSSCLIMB_PUZZLES } from "../src/games/crossclimb/puzzles.ts";
import { matchesCategory, normalizeGuess } from "../src/games/pinpoint/engine.ts";
import { PINPOINT_CATEGORIES } from "../src/games/pinpoint/categories.ts";

let failures = 0;

// ---- Crossclimb ----
const seen = new Set<string>();
for (const [index, puzzle] of CROSSCLIMB_PUZZLES.entries()) {
  if (puzzle.words.length !== 5 || puzzle.clues.length !== 3) {
    failures++;
    console.error(`  ! wrong shape (crossclimb #${index})`);
  }
  const length = puzzle.words[0].length;
  for (const word of puzzle.words) {
    if (word.length !== length || !new RegExp(`^[A-Z]{${length}}$`).test(word)) {
      failures++;
      console.error(`  ! bad word "${word}" (#${index})`);
    }
  }
  if (new Set(puzzle.words).size !== 5) {
    failures++;
    console.error(`  ! repeated word (#${index})`);
  }
  if (!isLadder(puzzle.words)) {
    failures++;
    console.error(`  ! not a ladder (#${index}: ${puzzle.words.join(" → ")})`);
  }
  if (puzzle.clues.some((clue) => clue.trim().length < 3)) {
    failures++;
    console.error(`  ! empty clue (#${index})`);
  }
  const key = puzzle.words.join(",");
  if (seen.has(key)) {
    failures++;
    console.error(`  ! duplicate puzzle (#${index})`);
  }
  seen.add(key);
}
console.log(
  `Crossclimb: ${CROSSCLIMB_PUZZLES.length} puzzles, all ladders ${seen.size === CROSSCLIMB_PUZZLES.length ? "unique" : "DUPLICATED"}`,
);

// differsByOne sanity
if (!differsByOne("COLD", "CORD")) {
  failures++;
  console.error("! differsByOne missed a one-letter change");
}
if (differsByOne("COLD", "WARM") || differsByOne("COLD", "COLD")) {
  failures++;
  console.error("! differsByOne accepted an invalid pair");
}

// ---- Pinpoint ----
const answers = new Set<string>();
for (const [index, category] of PINPOINT_CATEGORIES.entries()) {
  if (category.clues.length !== 5 || category.clues.some((clue) => !clue.trim())) {
    failures++;
    console.error(`  ! bad clues (#${index})`);
  }
  const key = normalizeGuess(category.answer);
  if (answers.has(key)) {
    failures++;
    console.error(`  ! duplicate answer "${category.answer}"`);
  }
  answers.add(key);
  if (!matchesCategory(category, category.answer)) {
    failures++;
    console.error(`  ! answer does not match itself (#${index})`);
  }
  for (const alias of category.aliases) {
    if (!matchesCategory(category, alias)) {
      failures++;
      console.error(`  ! alias "${alias}" does not match "${category.answer}"`);
    }
  }
}

const fruits = PINPOINT_CATEGORIES.find((category) => category.answer === "Fruits")!;
if (!matchesCategory(fruits, "fruit") || !matchesCategory(fruits, "  FRUITS! ")) {
  failures++;
  console.error("! plural / punctuation matching failed");
}
if (matchesCategory(fruits, "vegetables")) {
  failures++;
  console.error("! wrong guess accepted");
}
const nba = PINPOINT_CATEGORIES.find((category) => category.answer === "NBA teams")!;
if (!matchesCategory(nba, "nba team") || !matchesCategory(nba, "basketball teams")) {
  failures++;
  console.error("! alias matching failed for NBA teams");
}

console.log(
  `Pinpoint: ${PINPOINT_CATEGORIES.length} categories, ${answers.size} unique answers`,
);

if (failures > 0) {
  console.error(`\nFAILED: ${failures} problem(s)`);
  process.exit(1);
}
console.log("\nAll checks passed.");
