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
  await waitFor(cdp, "document.querySelectorAll('.game-card').length === 4", "the dashboard", 5000);
  const cards = await cdp.evaluate<number>("document.querySelectorAll('.game-card').length");
  const solvedTag = await cdp.evaluate<boolean>(
    "[...document.querySelectorAll('.tag')].some(t => /solved/i.test(t.textContent || ''))",
  );
  check("dashboard lists every game", cards === 4, `${cards} cards`);
  check("dashboard reflects today's solve", solvedTag);

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
