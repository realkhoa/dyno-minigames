import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { GameShell } from "../../components/GameShell";
import { Modal } from "../../components/Modal";
import { CrownIcon, MarkIcon } from "../../components/icons";
import {
  clearGameProgress,
  formatTime,
  loadGameProgress,
  saveGameProgress,
} from "../../lib/storage";
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  findConflicts,
  generatePuzzle,
  isSolved,
  todayKey,
  type Difficulty,
} from "./engine";

type Mode = "daily" | "practice";
type Tool = "queen" | "mark";

const DAILY_DIFFICULTY: Difficulty = "hard";

const REGION_FILLS = [
  "hsl(212, 16%, 24%)",
  "hsl(36, 18%, 24%)",
  "hsl(158, 14%, 23%)",
  "hsl(292, 13%, 25%)",
  "hsl(196, 12%, 26%)",
  "hsl(48, 17%, 23%)",
  "hsl(8, 16%, 25%)",
  "hsl(232, 14%, 25%)",
  "hsl(120, 12%, 24%)",
];

const REGION_HUES = [212, 36, 158, 292, 196, 48, 8, 232, 120];

function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Assign palette entries so neighbouring regions never look alike.
 * Regions are painted in degree order, always choosing the hue furthest
 * from the ones already around it.
 */
function buildRegionFills(size: number, regions: number[]): string[] {
  const adjacency: Array<Set<number>> = Array.from({ length: size }, () => new Set<number>());
  for (let index = 0; index < size * size; index++) {
    const row = Math.floor(index / size);
    const col = index % size;
    if (col + 1 < size && regions[index] !== regions[index + 1]) {
      adjacency[regions[index]].add(regions[index + 1]);
      adjacency[regions[index + 1]].add(regions[index]);
    }
    if (row + 1 < size && regions[index] !== regions[index + size]) {
      adjacency[regions[index]].add(regions[index + size]);
      adjacency[regions[index + size]].add(regions[index]);
    }
  }

  const order = Array.from({ length: size }, (_, i) => i).sort(
    (a, b) => adjacency[b].size - adjacency[a].size,
  );
  const assigned = new Array<number>(size).fill(-1);
  const used = new Set<number>();

  for (const region of order) {
    let best = -1;
    let bestScore = -1;
    for (let slot = 0; slot < REGION_FILLS.length; slot++) {
      if (used.has(slot)) continue;
      let score = 360;
      for (const neighbor of adjacency[region]) {
        const other = assigned[neighbor];
        if (other < 0) continue;
        score = Math.min(score, hueDistance(REGION_HUES[slot], REGION_HUES[other]));
      }
      if (score > bestScore) {
        bestScore = score;
        best = slot;
      }
    }
    if (best < 0) best = 0;
    assigned[region] = best;
    used.add(best);
  }

  return assigned.map((slot) => REGION_FILLS[slot]);
}

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 9);
}

function solutionLabel(count: number): string {
  if (count >= 60) return "60+ solutions";
  return count === 1 ? "1 solution" : `${count} solutions`;
}

export function QueensGame() {
  const [mode, setMode] = useState<Mode>("daily");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [practiceSeed, setPracticeSeed] = useState(randomSeed);
  const [tool, setTool] = useState<Tool>("queen");

  const dailySeed = useMemo(() => todayKey(), []);
  const activeDifficulty = mode === "daily" ? DAILY_DIFFICULTY : difficulty;
  const seed = mode === "daily" ? dailySeed : practiceSeed;

  const puzzle = useMemo(
    () => generatePuzzle(seed, activeDifficulty),
    [seed, activeDifficulty],
  );
  const size = puzzle.size;
  const total = size * size;

  const [cells, setCells] = useState<number[]>(() => new Array(total).fill(0));
  const [seconds, setSeconds] = useState(0);
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [winDismissed, setWinDismissed] = useState(false);
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const queens = useMemo(() => cells.map((value) => value === 1), [cells]);
  const regionFills = useMemo(
    () => buildRegionFills(size, puzzle.regions),
    [size, puzzle.regions],
  );
  const won = useMemo(
    () => isSolved(size, puzzle.regions, queens),
    [size, puzzle.regions, queens],
  );
  const conflicts = useMemo(
    () => findConflicts(size, puzzle.regions, queens),
    [size, puzzle.regions, queens],
  );
  const placed = useMemo(() => queens.filter(Boolean).length, [queens]);

  useEffect(() => {
    const saved = loadGameProgress("queens", puzzle.id);
    if (saved) {
      const restored = new Array<number>(total).fill(0);
      for (let i = 0; i < total; i++) restored[i] = saved.cells[i] ?? 0;
      setCells(restored);
      setSeconds(saved.seconds);
      setWinDismissed(saved.solved);
    } else {
      setCells(new Array<number>(total).fill(0));
      setSeconds(0);
      setWinDismissed(false);
    }
    setHydratedId(puzzle.id);
    setFocused(null);
  }, [puzzle, total]);

  useEffect(() => {
    if (won) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [won, puzzle.id]);

  useEffect(() => {
    if (hydratedId !== puzzle.id) return;
    saveGameProgress("queens", puzzle.id, { cells, seconds, solved: won });
  }, [cells, seconds, won, puzzle.id, hydratedId]);

  const setCellValue = useCallback(
    (index: number, value: number) => {
      if (won) return;
      setCells((previous) => {
        if (previous[index] === value) return previous;
        const next = previous.slice();
        next[index] = value;
        return next;
      });
    },
    [won],
  );

  const applyTool = useCallback(
    (index: number) => {
      if (won) return;
      setCells((previous) => {
        const next = previous.slice();
        if (tool === "queen") next[index] = next[index] === 1 ? 0 : 1;
        else next[index] = next[index] === 2 ? 0 : 2;
        return next;
      });
    },
    [tool, won],
  );

  const moveFocus = useCallback(
    (index: number, deltaRow: number, deltaCol: number) => {
      const row = Math.floor(index / size) + deltaRow;
      const col = (index % size) + deltaCol;
      if (row < 0 || row >= size || col < 0 || col >= size) return;
      const next = row * size + col;
      setFocused(next);
      cellRefs.current[next]?.focus();
    },
    [size],
  );

  const onCellKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          moveFocus(index, -1, 0);
          return;
        case "ArrowDown":
          event.preventDefault();
          moveFocus(index, 1, 0);
          return;
        case "ArrowLeft":
          event.preventDefault();
          moveFocus(index, 0, -1);
          return;
        case "ArrowRight":
          event.preventDefault();
          moveFocus(index, 0, 1);
          return;
        case "1":
        case "q":
        case "Q":
          event.preventDefault();
          setCellValue(index, 1);
          return;
        case "2":
        case "x":
        case "X":
          event.preventDefault();
          setCellValue(index, 2);
          return;
        case "0":
        case "Backspace":
        case "Delete":
          event.preventDefault();
          setCellValue(index, 0);
          return;
        default:
      }
    },
    [moveFocus, setCellValue],
  );

  const restart = () => {
    setCells(new Array<number>(total).fill(0));
    setSeconds(0);
    setWinDismissed(false);
    setFocused(null);
    clearGameProgress("queens", puzzle.id);
  };

  const newPracticePuzzle = () => {
    setPracticeSeed(randomSeed());
    setWinDismissed(false);
  };

  const dateLabel = new Date(`${dailySeed}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  const status = won
    ? "Solved — one queen in every row, column and region."
    : conflicts.size > 0
      ? `${conflicts.size} queen${conflicts.size === 1 ? "" : "s"} break a rule — they are highlighted.`
      : placed === size
        ? "All queens placed, but the rules are not satisfied yet."
        : `${placed} of ${size} queens placed. No conflicts so far.`;

  return (
    <GameShell
      title="Queens"
      subtitle={
        <>
          {mode === "daily" ? `Daily puzzle · ${dateLabel}` : "Practice"}
          <span className="dot-separator">·</span>
          {DIFFICULTY_LABELS[activeDifficulty]}
          <span className="dot-separator">·</span>
          {size}×{size}
          <span className="dot-separator">·</span>
          {solutionLabel(puzzle.solutionCount)}
        </>
      }
      helpTitle="How to play Queens"
      help={
        <>
          <p className="modal-lede">
            Place one queen in every row, column and coloured region — and keep them apart.
          </p>
          <ul className="modal-rules">
            <li>
              Exactly <strong>{size} queens</strong> on a {size}×{size} board.
            </li>
            <li>One queen per row and one per column.</li>
            <li>One queen per coloured region.</li>
            <li>Queens may never touch — not even diagonally.</li>
            <li>
              Use the <strong>Mark</strong> tool (or right-click) to flag cells you have ruled out.
              Marks are notes only.
            </li>
          </ul>
          <p className="modal-note">
            This board has {solutionLabel(puzzle.solutionCount)}; any arrangement that satisfies
            every rule wins.
          </p>
        </>
      }
    >
      <section className="board-panel" aria-label="Queens board">
        <div className="board-toolbar">
          <div className="segmented" role="group" aria-label="Game mode">
            <button
              type="button"
              className={mode === "daily" ? "is-active" : ""}
              aria-pressed={mode === "daily"}
              onClick={() => setMode("daily")}
            >
              Daily
            </button>
            <button
              type="button"
              className={mode === "practice" ? "is-active" : ""}
              aria-pressed={mode === "practice"}
              onClick={() => setMode("practice")}
            >
              Practice
            </button>
          </div>
          <div className="toolbar-side">
            <div className="tool-toggle" role="group" aria-label="Tool">
              <button
                type="button"
                className={tool === "queen" ? "is-active" : ""}
                aria-pressed={tool === "queen"}
                onClick={() => setTool("queen")}
              >
                <CrownIcon />
                <span>Queen</span>
              </button>
              <button
                type="button"
                className={tool === "mark" ? "is-active" : ""}
                aria-pressed={tool === "mark"}
                onClick={() => setTool("mark")}
              >
                <MarkIcon />
                <span>Mark</span>
              </button>
            </div>
            <span className={`timer ${won ? "is-done" : ""}`}>{formatTime(seconds)}</span>
            <button className="btn btn-ghost btn-sm" type="button" onClick={restart}>
              Restart
            </button>
          </div>
        </div>

        {mode === "practice" ? (
          <div className="difficulty-row" role="group" aria-label="Difficulty">
            <span className="difficulty-label">Size</span>
            <div className="chips">
              {DIFFICULTIES.map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`chip ${difficulty === level ? "is-active" : ""}`}
                  aria-pressed={difficulty === level}
                  onClick={() => setDifficulty(level)}
                >
                  {DIFFICULTY_LABELS[level]}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="board-frame">
          <div
            className="queens-board"
            style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
            role="group"
            aria-label={`Queens board, ${size} by ${size}`}
          >
            {cells.map((value, index) => {
              const row = Math.floor(index / size);
              const col = index % size;
              const region = puzzle.regions[index];
              const conflict = conflicts.has(index);
              const classes = ["queens-cell"];
              if (row === 0 || puzzle.regions[index - size] !== region) classes.push("edge-t");
              if (col === 0 || puzzle.regions[index - 1] !== region) classes.push("edge-l");
              if (col === size - 1 || puzzle.regions[index + 1] !== region) classes.push("edge-r");
              if (row === size - 1 || puzzle.regions[index + size] !== region)
                classes.push("edge-b");
              if (conflict) classes.push("is-conflict");

              return (
                <button
                  key={index}
                  type="button"
                  ref={(element) => {
                    cellRefs.current[index] = element;
                  }}
                  className={classes.join(" ")}
                  style={{ background: regionFills[region] }}
                  tabIndex={focused === index || (focused === null && index === 0) ? 0 : -1}
                  aria-label={`Row ${row + 1}, column ${col + 1}, region ${region + 1}: ${
                    value === 1 ? "queen" : value === 2 ? "marked" : "empty"
                  }`}
                  aria-invalid={conflict || undefined}
                  onFocus={() => setFocused(index)}
                  onClick={() => {
                    setFocused(index);
                    applyTool(index);
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setCellValue(index, value === 2 ? 0 : 2);
                  }}
                  onKeyDown={(event) => onCellKeyDown(event, index)}
                >
                  {value === 1 ? <CrownIcon className="queens-icon" /> : null}
                  {value === 2 ? <MarkIcon className="queens-mark" /> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div
          className={`board-status ${won ? "is-win" : conflicts.size > 0 ? "is-warn" : ""}`}
          role="status"
          aria-live="polite"
        >
          <span className="status-dot" aria-hidden="true" />
          <span>{status}</span>
        </div>

        <div className="board-actions">
          {mode === "practice" ? (
            <button className="btn btn-primary btn-sm" type="button" onClick={newPracticePuzzle}>
              New puzzle
            </button>
          ) : (
            <p className="daily-note">
              A fresh Queens board every day. Practice mode has four board sizes.
            </p>
          )}
        </div>
      </section>

      <aside className="game-side">
        <section className="panel">
          <div className="panel-head">
            <h2>Queens</h2>
            <span className="panel-value">
              {placed}/{size}
            </span>
          </div>
          <div
            className="progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={size}
            aria-valuenow={placed}
            aria-label="Queens placed"
          >
            <span style={{ width: `${(placed / size) * 100}%` }} />
          </div>
          <dl className="stat-list">
            <div>
              <dt>Time</dt>
              <dd>{formatTime(seconds)}</dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>
                {size}×{size}
              </dd>
            </div>
            <div>
              <dt>Regions</dt>
              <dd>{size}</dd>
            </div>
            <div>
              <dt>Solutions</dt>
              <dd>{puzzle.solutionCount >= 60 ? "60+" : puzzle.solutionCount}</dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <h2>Rules</h2>
          <ul className="rule-list">
            <li>
              <span className="rule-glyph">
                <CrownIcon />
              </span>
              Place exactly {size} queens.
            </li>
            <li>One queen in every row and every column.</li>
            <li>One queen in every coloured region.</li>
            <li>Queens may not touch, not even diagonally.</li>
            <li>
              <MarkIcon /> marks are notes for cells you have ruled out.
            </li>
          </ul>
        </section>
      </aside>

      {won && !winDismissed ? (
        <Modal
          title="All queens placed"
          variant="win"
          onClose={() => setWinDismissed(true)}
          footer={
            <div className="modal-actions">
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => {
                  setWinDismissed(true);
                  if (mode === "practice") newPracticePuzzle();
                  else restart();
                }}
              >
                {mode === "practice" ? "Next puzzle" : "Play again"}
              </button>
              <a className="btn btn-ghost" href="#/">
                Dashboard
              </a>
            </div>
          }
        >
          <div className="win-symbols" aria-hidden="true">
            <CrownIcon />
          </div>
          <p className="win-time">{formatTime(seconds)}</p>
          <p className="modal-lede">
            One queen in every row, column and region — none of them touching.
          </p>
          <p className="modal-note">
            {size}×{size} · {solutionLabel(puzzle.solutionCount)}
          </p>
        </Modal>
      ) : null}
    </GameShell>
  );
}
