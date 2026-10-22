/**
 * End-to-end UI check driven over the Chrome DevTools Protocol.
 * Requires the preview server on http://localhost:4173.
 *
 *   node --experimental-strip-types scripts/ui-check.ts
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generatePuzzle, todayKey } from "../src/games/tango/engine.ts";
import { generatePuzzle as generateQueens } from "../src/games/queens/engine.ts";
import { generatePuzzle as generateZip } from "../src/games/zip/engine.ts";
import { generatePuzzle as generateSudoku } from "../src/games/sudoku/engine.ts";
import { generatePuzzle as generatePatches } from "../src/games/patches/engine.ts";
import { puzzleForSeed } from "../src/games/crossclimb/engine.ts";
import { categoryForSeed } from "../src/games/pinpoint/engine.ts";
import { generatePuzzle as generateWend } from "../src/games/wend/engine.ts";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9333;
const APP = "http://localhost:4173/";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

class Cdp {
  private socket: WebSocket;
  private nextId = 0;
  private pending = new Map<number, Pending>();
  errors: string[] = [];

  private constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as {
        id?: number;
        method?: string;
        params?: { exceptionDetails?: { text?: string; exception?: { description?: string } } };
        result?: { result?: { value?: unknown }; exceptionDetails?: { text?: string } };
        error?: { message?: string };
      };
      if (message.method === "Runtime.exceptionThrown") {
        this.errors.push(message.params?.exceptionDetails?.exception?.description ?? "exception");
      }
      if (message.id && this.pending.has(message.id)) {
        const entry = this.pending.get(message.id)!;
        this.pending.delete(message.id);
        if (message.error) entry.reject(new Error(message.error.message ?? "CDP error"));
        else entry.resolve(message.result);
      }
    });
  }

  static async connect(url: string): Promise<Cdp> {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", () => reject(new Error("WebSocket failed")), { once: true });
    });
    const client = new Cdp(socket);
    await client.send("Runtime.enable", {});
    await client.send("Log.enable", {});
    return client;
  }

  send(method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate<T>(expression: string): Promise<T> {
    const response = (await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    })) as { result?: { value?: T }; exceptionDetails?: { text?: string } };
    if (response.exceptionDetails) {
      throw new Error(`evaluate failed: ${response.exceptionDetails.text}`);
    }
    return response.result?.value as T;
  }

  close(): void {
    this.socket.close();
  }
}

const results: Array<{ name: string; ok: boolean; detail?: string }> = [];

function check(name: string, ok: boolean, detail?: string): void {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function waitFor(
  cdp: Cdp,
  expression: string,
  label: string,
  timeout = 8000,
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await cdp.evaluate<boolean>(expression)) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

const userDataDir = mkdtempSync(join(tmpdir(), "dyno-ui-"));

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--disable-extensions",
    "--window-size=1280,1000",
    `${APP}#/tango`,
  ],
  { stdio: "ignore" },
);

let cdp: Cdp | null = null;

try {
  let targetUrl = "";
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = (await response.json()) as Array<{
        type: string;
        url: string;
        webSocketDebuggerUrl: string;
      }>;
      const page = targets.find(
        (target) => target.type === "page" && target.webSocketDebuggerUrl,
      );
      if (page) {
        targetUrl = page.webSocketDebuggerUrl;
        break;
      }
    } catch {
      // Chrome is still starting up.
    }
    await sleep(200);
  }
  if (!targetUrl) throw new Error("Could not reach Chrome's debugging endpoint");

  cdp = await Cdp.connect(targetUrl);

  await waitFor(
    cdp,
    "document.querySelectorAll('.tango-cell').length === 36",
    "the Tango board to render",
  );

  const lockedIndexes = await cdp.evaluate<number[]>(
    "[...document.querySelectorAll('.tango-cell')].map((cell, i) => cell.classList.contains('is-locked') ? i : -1).filter(i => i >= 0)",
  );
  const puzzle = generatePuzzle(todayKey(), "deadly");
  const expectedLocked = puzzle.givens.filter((value) => value !== 0).length;
  check("36 cells rendered", true);
  check(
    "locked clues are not editable-looking",
    lockedIndexes.length === expectedLocked && expectedLocked >= 3,
    `${lockedIndexes.length} locked (expected ${expectedLocked})`,
  );

  const header = await cdp.evaluate<string>(
    "document.querySelector('.game-heading p')?.textContent ?? ''",
  );
  check("header shows the daily focus", header.length > 0, String(header));

  // Cycle a free cell: empty -> sun -> moon -> empty.
  const freeIndex = await cdp.evaluate<number>(
    "[...document.querySelectorAll('.tango-cell')].findIndex(c => !c.classList.contains('is-locked'))",
  );
  const clickCell = (index: number) =>
    cdp!.evaluate<void>(`document.querySelectorAll('.tango-cell')[${index}].click()`);
  const cellClasses = (index: number) =>
    cdp!.evaluate<string>(`document.querySelectorAll('.tango-cell')[${index}].className`);

  await clickCell(freeIndex);
  await sleep(80);
  const afterFirst = await cellClasses(freeIndex);
  check("click places a sun", afterFirst.includes("is-sun"));

  await clickCell(freeIndex);
  await sleep(80);
  const afterSecond = await cellClasses(freeIndex);
  check("second click swaps to a moon", afterSecond.includes("is-moon"));

  await clickCell(freeIndex);
  await sleep(80);
  const afterThird = await cellClasses(freeIndex);
  check("third click clears the cell", !afterThird.includes("is-sun") && !afterThird.includes("is-moon"));

  // Locked cells ignore input.
  const lockedBefore = await cellClasses(lockedIndexes[0]);
  await clickCell(lockedIndexes[0]);
  await sleep(80);
  const lockedAfter = await cellClasses(lockedIndexes[0]);
  check("locked cell ignores clicks", lockedBefore === lockedAfter);

  // A trio of suns must raise the conflict banner.
  const triple = await cdp.evaluate<number[] | null>(
    `(() => {
      const cells = [...document.querySelectorAll('.tango-cell')];
      const size = 6;
      for (let r = 0; r < size; r++) {
        for (let c = 0; c + 2 < size; c++) {
          const run = [r * size + c, r * size + c + 1, r * size + c + 2];
          if (run.every(i => !cells[i].classList.contains('is-locked') &&
              !cells[i].classList.contains('is-filled'))) return run;
        }
      }
      return null;
    })()`,
  );
  if (triple) {
    for (const index of triple) {
      await clickCell(index);
      await sleep(40);
    }
    await sleep(120);
    const warn = await cdp.evaluate<boolean>("!!document.querySelector('.board-status.is-warn')");
    const statusText = await cdp.evaluate<string>(
      "document.querySelector('.board-status')?.textContent ?? ''",
    );
    check("conflict banner reacts to a triple", warn, String(statusText));
  } else {
    check("conflict banner reacts to a triple", false, "no free triple found");
  }

  await cdp.evaluate<void>("[...document.querySelectorAll('button')].find(b => b.textContent === 'Restart')?.click()");
  await sleep(200);
  const cleared = await cdp.evaluate<number>(
    "document.querySelectorAll('.tango-cell.is-filled:not(.is-locked)').length",
  );
  check("restart clears player cells", cleared === 0, `${cleared} remaining`);

  // Persistence.
  await clickCell(freeIndex);
  await sleep(500);
  await cdp.send("Page.reload", {});
  await waitFor(
    cdp,
    "document.querySelectorAll('.tango-cell').length === 36",
    "the board after reload",
  );
  await sleep(300);
  const restored = await cellClasses(freeIndex);
  check("progress survives a reload", restored.includes("is-sun"));

  // Practice mode and difficulty switching.
  const clickByText = (selector: string, text: string) =>
    cdp!.evaluate<void>(
      `[...document.querySelectorAll('${selector}')].find((el) => el.textContent?.trim() === '${text}')?.click()`,
    );

  await clickByText(".segmented button", "Practice");
  await sleep(350);
  const chipCount = await cdp.evaluate<number>("document.querySelectorAll('.chip').length");
  check("practice exposes four difficulties", chipCount === 4, `${chipCount} chips`);

  await clickByText(".chip", "Easy");
  await sleep(400);
  const easyHeader = await cdp.evaluate<string>(
    "document.querySelector('.game-heading p')?.textContent ?? ''",
  );
  const easyMatch = easyHeader.match(/(\d+)\s+solutions/);
  const easyLocked = await cdp.evaluate<number>(
    "document.querySelectorAll('.tango-cell.is-locked').length",
  );
  check(
    "easy puzzle accepts multiple solutions",
    easyMatch !== null && Number(easyMatch[1]) > 1,
    easyHeader,
  );
  check("easy puzzle keeps locked clues", easyLocked >= 3, `${easyLocked} locked`);

  await clickByText(".chip", "Deadly");
  await sleep(400);
  const deadlyHeader = await cdp.evaluate<string>(
    "document.querySelector('.game-heading p')?.textContent ?? ''",
  );
  check("deadly practice is unique", /1 solution\b/.test(deadlyHeader), deadlyHeader);

  await clickByText(".segmented button", "Daily");
  await sleep(350);

  // Solve the daily puzzle and expect the win dialog.
  await cdp.evaluate(
    `(async () => {
      const solution = ${JSON.stringify(puzzle.solution)};
      const cells = [...document.querySelectorAll('.tango-cell')];
      const valueOf = (el) => el.classList.contains('is-sun') ? 1 : el.classList.contains('is-moon') ? 2 : 0;
      for (let i = 0; i < cells.length; i++) {
        let guard = 0;
        while (valueOf(cells[i]) !== solution[i] && guard++ < 4) {
          cells[i].click();
          await new Promise((r) => setTimeout(r, 15));
        }
      }
      return true;
    })()`,
  );

  await waitFor(cdp, "!!document.querySelector('.modal-card.is-win')", "the win dialog", 6000);
  const winTitle = await cdp.evaluate<string>(
    "document.querySelector('.modal-card.is-win .modal-title')?.textContent ?? ''",
  );
  const winStatus = await cdp.evaluate<boolean>("!!document.querySelector('.board-status.is-win')");
  check("solving opens the win dialog", winTitle.length > 0, String(winTitle));
  check("board reports the win", winStatus);

  // Dashboard and saved daily state.
  await cdp.evaluate<void>("location.hash = '#/'");
  await waitFor(cdp, "document.querySelectorAll('.game-card').length === 8", "the dashboard", 5000);
  const cards = await cdp.evaluate<number>("document.querySelectorAll('.game-card').length");
  const solvedTag = await cdp.evaluate<boolean>(
    "[...document.querySelectorAll('.tag')].some(t => /solved/i.test(t.textContent || ''))",
  );
  check("dashboard lists every game", cards === 8, `${cards} cards`);
  check("dashboard reflects today's solve", solvedTag);

  /* ---------------- Queens ---------------- */

  await cdp.evaluate<void>("location.hash = '#/queens'");
  await waitFor(
    cdp,
    "document.querySelectorAll('.queens-cell').length === 64",
    "the Queens board",
    6000,
  );
  check("queens board renders 8x8", true, "64 cells");

  await cdp.evaluate<void>("document.querySelectorAll('.queens-cell')[0].click()");
  await sleep(120);
  const queenPlaced = await cdp.evaluate<boolean>(
    "!!document.querySelectorAll('.queens-cell')[0].querySelector('svg')",
  );
  check("click places a queen", queenPlaced);

  await cdp.evaluate<void>(
    "[...document.querySelectorAll('.tool-toggle button')].find((b) => b.textContent?.includes('Mark'))?.click()",
  );
  await cdp.evaluate<void>("document.querySelectorAll('.queens-cell')[1].click()");
  await sleep(120);
  const markPlaced = await cdp.evaluate<boolean>(
    "document.querySelectorAll('.queens-cell')[1].querySelectorAll('svg').length === 1",
  );
  check("mark tool adds a note", markPlaced);

  await cdp.evaluate<void>(
    "[...document.querySelectorAll('button')].find((b) => b.textContent === 'Restart')?.click()",
  );
  await sleep(150);
  const clearedQueens = await cdp.evaluate<number>(
    "document.querySelectorAll('.queens-cell svg').length",
  );
  check("queens restart clears the board", clearedQueens === 0, `${clearedQueens} icons`);

  // Practice sizes change the board.
  await clickByText(".segmented button", "Practice");
  await sleep(350);
  await clickByText(".chip", "Easy");
  await sleep(450);
  const easyCells = await cdp.evaluate<number>("document.querySelectorAll('.queens-cell').length");
  check("queens easy is a 6x6 board", easyCells === 36, `${easyCells} cells`);

  await clickByText(".segmented button", "Daily");
  await sleep(400);

  const queensPuzzle = generateQueens(todayKey(), "hard");
  await cdp.evaluate<void>(
    "[...document.querySelectorAll('.tool-toggle button')].find((b) => b.textContent?.includes('Queen'))?.click()",
  );
  await cdp.evaluate(
    `(async () => {
      const solution = ${JSON.stringify(queensPuzzle.solution)};
      const size = ${queensPuzzle.size};
      const cells = [...document.querySelectorAll('.queens-cell')];
      for (let row = 0; row < size; row++) {
        cells[row * size + solution[row]].click();
        await new Promise((r) => setTimeout(r, 14));
      }
    })()`,
  );
  await waitFor(cdp, "!!document.querySelector('.modal-card.is-win')", "the Queens win dialog", 6000);
  const queensWin = await cdp.evaluate<string>(
    "document.querySelector('.modal-card.is-win .modal-title')?.textContent ?? ''",
  );
  check("queens solve opens the win dialog", queensWin.length > 0, queensWin);

  /* ---------------- Zip ---------------- */

  await cdp.evaluate<void>("location.hash = '#/zip'");
  await waitFor(
    cdp,
    "document.querySelectorAll('.zip-cell').length === 36",
    "the Zip board",
    6000,
  );

  const zipPuzzle = generateZip(todayKey(), "medium");
  const startCell = zipPuzzle.numbers[0].index;
  const startRow = Math.floor(startCell / 6);
  const startCol = startCell % 6;
  const farCell = Array.from({ length: 36 }, (_, i) => i).find((i) => {
    const row = Math.floor(i / 6);
    const col = i % 6;
    return Math.abs(row - startRow) + Math.abs(col - startCol) > 1;
  })!;
  await cdp.evaluate<void>(`document.querySelectorAll('.zip-cell')[${startCell}].click()`);
  await sleep(120);
  const started = await cdp.evaluate<number>(
    "document.querySelectorAll('.zip-cell.is-visited').length",
  );
  check("zip starts on the first number", started === 1, `${started} cells`);

  const beforeJump = await cdp.evaluate<number>(
    "document.querySelectorAll('.zip-cell.is-visited').length",
  );
  await cdp.evaluate<void>(`document.querySelectorAll('.zip-cell')[${farCell}].click()`);
  await sleep(100);
  const afterJump = await cdp.evaluate<number>(
    "document.querySelectorAll('.zip-cell.is-visited').length",
  );
  check("zip ignores non-adjacent taps", afterJump === beforeJump, `${afterJump} cells`);

  await cdp.evaluate(
    `(async () => {
      const solution = ${JSON.stringify(zipPuzzle.solution)};
      const cells = [...document.querySelectorAll('.zip-cell')];
      for (const index of solution) {
        cells[index].click();
        await new Promise((r) => setTimeout(r, 12));
      }
    })()`,
  );

  await waitFor(cdp, "!!document.querySelector('.modal-card.is-win')", "the Zip win dialog", 8000);
  const zipLine = await cdp.evaluate<boolean>("!!document.querySelector('.zip-path polyline')");
  const zipWin = await cdp.evaluate<string>(
    "document.querySelector('.modal-card.is-win .modal-title')?.textContent ?? ''",
  );
  check("zip draws the path", zipLine);
  check("zip completes the board", zipWin.length > 0, zipWin);

  /* ---------------- Mini Sudoku ---------------- */

  await cdp.evaluate<void>("location.hash = '#/sudoku'");
  await waitFor(
    cdp,
    "document.querySelectorAll('.sudoku-cell').length === 36",
    "the Sudoku board",
    6000,
  );
  const sudokuPuzzle = generateSudoku(todayKey(), "medium");
  const givenIndex = sudokuPuzzle.givens.findIndex((value) => value !== 0);
  const givenText = await cdp.evaluate<string>(
    `document.querySelectorAll('.sudoku-cell')[${givenIndex}].textContent`,
  );
  await cdp.evaluate<void>(`document.querySelectorAll('.sudoku-cell')[${givenIndex}].click()`);
  await sleep(80);
  await cdp.evaluate<void>(
    `document.querySelectorAll('.sudoku-key')[${(sudokuPuzzle.givens[givenIndex] % 6)}].click()`,
  );
  await sleep(120);
  const givenAfter = await cdp.evaluate<string>(
    `document.querySelectorAll('.sudoku-cell')[${givenIndex}].textContent`,
  );
  check("sudoku clues cannot be edited", givenText === givenAfter, `${givenText} → ${givenAfter}`);

  await cdp.evaluate(
    `(async () => {
      const solution = ${JSON.stringify(sudokuPuzzle.solution)};
      const givens = ${JSON.stringify(sudokuPuzzle.givens)};
      const cells = [...document.querySelectorAll('.sudoku-cell')];
      const keys = [...document.querySelectorAll('.sudoku-key')];
      for (let i = 0; i < cells.length; i++) {
        if (givens[i]) continue;
        cells[i].click();
        await new Promise((r) => setTimeout(r, 16));
        keys[solution[i] - 1].click();
        await new Promise((r) => setTimeout(r, 16));
      }
    })()`,
  );

  await waitFor(
    cdp,
    "!!document.querySelector('.modal-card.is-win')",
    "the Sudoku win dialog",
    8000,
  );
  const sudokuWin = await cdp.evaluate<string>(
    "document.querySelector('.modal-card.is-win .modal-title')?.textContent ?? ''",
  );
  check("sudoku solve opens the win dialog", sudokuWin.length > 0, sudokuWin);

  /* ---------------- Patches ---------------- */

  await cdp.evaluate<void>("location.hash = '#/patches'");
  await waitFor(
    cdp,
    "document.querySelectorAll('.patches-cell').length === 49",
    "the Patches board",
    6000,
  );
  const patchPuzzle = generatePatches(todayKey(), "medium");
  const patchSize = patchPuzzle.size;

  // A whole-board selection holds many clues, so it must be rejected.
  await cdp.evaluate<void>(
    `document.querySelectorAll('.patches-cell')[0].click()`,
  );
  await sleep(80);
  await cdp.evaluate<void>(
    `document.querySelectorAll('.patches-cell')[${patchSize * patchSize - 1}].click()`,
  );
  await sleep(150);
  const rejected = await cdp.evaluate<number>("document.querySelectorAll('.patch').length");
  const warn = await cdp.evaluate<boolean>("!!document.querySelector('.board-status.is-warn')");
  check("patches rejects an invalid rectangle", rejected === 0 && warn);

  const first = patchPuzzle.solution[0];
  await cdp.evaluate<void>(`document.querySelectorAll('.patches-cell')[${first.y * patchSize + first.x}].click()`);
  await sleep(60);
  await cdp.evaluate<void>(
    `document.querySelectorAll('.patches-cell')[${
      (first.y + first.h - 1) * patchSize + first.x + first.w - 1
    }].click()`,
  );
  await sleep(150);
  const placed = await cdp.evaluate<number>("document.querySelectorAll('.patch').length");
  check("patches places a valid rectangle", placed === 1, `${placed} patches`);

  await cdp.evaluate<void>(
    `document.querySelectorAll('.patches-cell')[${first.y * patchSize + first.x}].click()`,
  );
  await sleep(150);
  const removed = await cdp.evaluate<number>("document.querySelectorAll('.patch').length");
  check("patches removes a patch on tap", removed === 0, `${removed} patches`);

  await cdp.evaluate(
    `(async () => {
      const rects = ${JSON.stringify(patchPuzzle.solution)};
      const size = ${patchSize};
      const cells = [...document.querySelectorAll('.patches-cell')];
      const tap = async (cell) => {
        cells[cell].click();
        await new Promise((r) => setTimeout(r, 18));
      };
      for (const rect of rects) {
        await tap(rect.y * size + rect.x);
        await tap((rect.y + rect.h - 1) * size + rect.x + rect.w - 1);
      }
    })()`,
  );

  await waitFor(cdp, "!!document.querySelector('.modal-card.is-win')", "the Patches win dialog", 8000);
  const patchesWin = await cdp.evaluate<string>(
    "document.querySelector('.modal-card.is-win .modal-title')?.textContent ?? ''",
  );
  check("patches tiling solves the board", patchesWin.length > 0, patchesWin);

  /* ---------------- Crossclimb ---------------- */

  await cdp.evaluate<void>("location.hash = '#/crossclimb'");
  await waitFor(
    cdp,
    "document.querySelectorAll('.climb-input').length === 3",
    "the Crossclimb ladder",
    6000,
  );
  const climb = puzzleForSeed(todayKey(), "daily");
  const climbWords = climb.puzzle.words.slice(1, 4);

  const setInput = (selector: string, index: number, value: string) =>
    cdp!.evaluate<void>(`(() => {
      const input = document.querySelectorAll('${selector}')[${index}];
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);

  await setInput(".climb-input", 0, "ZZZZ");
  await sleep(150);
  const wrongClimb = await cdp.evaluate<number>(
    "document.querySelectorAll('.climb-row.is-correct').length",
  );
  check("crossclimb rejects a wrong rung", wrongClimb === 0, `${wrongClimb} correct`);

  await cdp.evaluate(
    `(async () => {
      const words = ${JSON.stringify(climbWords)};
      const inputs = [...document.querySelectorAll('.climb-input')];
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      for (let i = 0; i < inputs.length; i++) {
        setter.call(inputs[i], words[i]);
        inputs[i].dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 45));
      }
    })()`,
  );

  await waitFor(cdp, "!!document.querySelector('.modal-card.is-win')", "the Crossclimb win dialog", 8000);
  const climbWin = await cdp.evaluate<string>(
    "document.querySelector('.modal-card.is-win .modal-title')?.textContent ?? ''",
  );
  check("crossclimb completes the ladder", climbWin.length > 0, climbWin);

  /* ---------------- Pinpoint ---------------- */

  await cdp.evaluate<void>("location.hash = '#/pinpoint'");
  await waitFor(
    cdp,
    "document.querySelectorAll('.pinpoint-clues li').length === 1",
    "the Pinpoint clue list",
    6000,
  );
  const pinpoint = categoryForSeed(todayKey(), "daily");

  await cdp.evaluate<void>(
    "[...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Reveal clue 2'))?.click()",
  );
  await sleep(160);
  const clueCount = await cdp.evaluate<number>(
    "document.querySelectorAll('.pinpoint-clues li').length",
  );
  check("pinpoint reveals the next clue", clueCount === 2, `${clueCount} clues`);

  await setInput(".pinpoint-form input", 0, "definitely not the answer");
  await cdp.evaluate<void>("document.querySelector('.pinpoint-form').requestSubmit()");
  await sleep(200);
  const wrongGuess = await cdp.evaluate<boolean>("!!document.querySelector('.board-status.is-warn')");
  check("pinpoint rejects a wrong category", wrongGuess);

  await setInput(".pinpoint-form input", 0, pinpoint.category.answer);
  await cdp.evaluate<void>("document.querySelector('.pinpoint-form').requestSubmit()");
  await waitFor(cdp, "!!document.querySelector('.modal-card.is-win')", "the Pinpoint win dialog", 8000);
  const pinpointWin = await cdp.evaluate<string>(
    "document.querySelector('.modal-card.is-win .modal-title')?.textContent ?? ''",
  );
  check("pinpoint accepts the category", pinpointWin.length > 0, pinpointWin);

  /* ---------------- Wend ---------------- */

  await cdp.evaluate<void>("location.hash = '#/wend'");
  await waitFor(
    cdp,
    "document.querySelectorAll('.wend-cell').length === 36",
    "the Wend board",
    6000,
  );
  const wendPuzzle = generateWend(todayKey(), "medium");

  const dragWord = async (cells: number[]) => {
    const points = await cdp!.evaluate<Array<{ x: number; y: number }>>(
      `(${JSON.stringify(cells)}).map((i) => {
        const rect = document.querySelectorAll('.wend-cell')[i].getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      })`,
    );
    await cdp!.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: points[0].x,
      y: points[0].y,
      button: "left",
      clickCount: 1,
    });
    for (const point of points.slice(1)) {
      await cdp!.send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: point.x,
        y: point.y,
        button: "left",
        buttons: 1,
      });
      await sleep(18);
    }
    const last = points[points.length - 1];
    await cdp!.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: last.x,
      y: last.y,
      button: "left",
      clickCount: 1,
    });
    await sleep(180);
  };

  await dragWord(wendPuzzle.solution[0].cells);
  const firstWord = await cdp.evaluate<number>(
    "document.querySelectorAll('.wend-slot.is-filled').length",
  );
  check("wend accepts a traced word", firstWord === 1, `${firstWord} words`);

  for (const entry of wendPuzzle.solution.slice(1)) {
    await dragWord(entry.cells);
  }

  await waitFor(cdp, "!!document.querySelector('.modal-card.is-win')", "the Wend win dialog", 8000);
  const wendWin = await cdp.evaluate<string>(
    "document.querySelector('.modal-card.is-win .modal-title')?.textContent ?? ''",
  );
  check("wend completes the board", wendWin.length > 0, wendWin);

  check("no page exceptions", cdp.errors.length === 0, cdp.errors.slice(0, 2).join(" | "));
} catch (error) {
  check("ui run completed", false, error instanceof Error ? error.message : String(error));
} finally {
  cdp?.close();
  chrome.kill();
  await sleep(300);
  try {
    rmSync(userDataDir, { recursive: true, force: true });
  } catch {
    // Chrome may still hold a handle; harmless for a temp folder.
  }
}

const failed = results.filter((entry) => !entry.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0) process.exit(1);
