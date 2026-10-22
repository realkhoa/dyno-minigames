import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { GameShell } from "../../components/GameShell";
import { Modal } from "../../components/Modal";
import {
  clearGameProgress,
  formatTime,
  loadGameJson,
  saveGameJson,
} from "../../lib/storage";
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  areAdjacent,
  generatePuzzle,
  isSolved,
  neighbors,
  nextNumber,
  reachedCount,
  todayKey,
  type Difficulty,
} from "./engine";

type Mode = "daily" | "practice";

const DAILY_DIFFICULTY: Difficulty = "medium";

interface SavedZip {
  path: number[];
  seconds: number;
  solved: boolean;
}

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 9);
}

export function ZipGame() {
  const [mode, setMode] = useState<Mode>("daily");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [practiceSeed, setPracticeSeed] = useState(randomSeed);

  const dailySeed = useMemo(() => todayKey(), []);
  const activeDifficulty = mode === "daily" ? DAILY_DIFFICULTY : difficulty;
  const seed = mode === "daily" ? dailySeed : practiceSeed;

  const puzzle = useMemo(
    () => generatePuzzle(seed, activeDifficulty),
    [seed, activeDifficulty],
  );
  const size = puzzle.size;
  const total = size * size;

  const [path, setPath] = useState<number[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [winDismissed, setWinDismissed] = useState(false);

  const solved = useMemo(() => isSolved(size, puzzle.numbers, path), [size, puzzle.numbers, path]);
  const visited = useMemo(() => new Set(path), [path]);
  const next = useMemo(() => nextNumber(path, puzzle.numbers), [path, puzzle.numbers]);
  const last = path.length > 0 ? path[path.length - 1] : null;
  const deadEnd = useMemo(() => {
    if (last === null || solved) return false;
    if (path.length === total) return false;
    return neighbors(size, last).every((neighbor) => visited.has(neighbor));
  }, [last, solved, path.length, total, size, visited]);

  useEffect(() => {
    const saved = loadGameJson<SavedZip>("zip", puzzle.id);
    const restored = Array.isArray(saved?.path)
      ? saved.path.filter(
          (cell) => Number.isInteger(cell) && cell >= 0 && cell < total,
        )
      : [];
    setPath([...new Set(restored)]);
    setSeconds(typeof saved?.seconds === "number" ? Math.max(0, saved.seconds) : 0);
    setWinDismissed(saved?.solved === true);
    setHydratedId(puzzle.id);
    setDragging(false);
  }, [puzzle, total]);

  useEffect(() => {
    if (solved) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [solved, puzzle.id]);

  useEffect(() => {
    if (hydratedId !== puzzle.id) return;
    saveGameJson<SavedZip>("zip", puzzle.id, { path, seconds, solved });
  }, [path, seconds, solved, puzzle.id, hydratedId]);

  useEffect(() => {
    const stop = () => setDragging(false);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  const extend = useCallback(
    (index: number) => {
      setPath((previous) => {
        if (previous.length === 0) {
          return index === puzzle.numbers[0].index ? [index] : previous;
        }
        const tail = previous[previous.length - 1];
        if (index === tail) return previous;

        const existing = previous.indexOf(index);
        if (existing >= 0) return previous.slice(0, existing + 1);
        if (!areAdjacent(size, tail, index)) return previous;

        const expected = puzzle.numbers[reachedCount(previous, puzzle.numbers)];
        const checkpoint = puzzle.numbers.find((number) => number.index === index);
        if (checkpoint && (!expected || checkpoint.value !== expected.value)) return previous;

        return [...previous, index];
      });
    },
    [puzzle.numbers, size],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, index: number) => {
    if (solved) return;
    event.preventDefault();
    setDragging(true);
    extend(index);
  };

  const onBoardPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging || solved) return;
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const cell = element?.closest<HTMLElement>("[data-zip-cell]");
    if (cell) extend(Number(cell.dataset.zipCell));
  };

  const restart = () => {
    setPath([]);
    setSeconds(0);
    setWinDismissed(false);
    setDragging(false);
    clearGameProgress("zip", puzzle.id);
  };

  const newPracticePuzzle = () => {
    setPracticeSeed(randomSeed());
    setWinDismissed(false);
  };

  const dateLabel = new Date(`${dailySeed}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  const reachedLast = reachedCount(path, puzzle.numbers) === puzzle.numbers.length;
  const status = solved
    ? "Path complete — every cell, every number in order."
    : deadEnd
      ? "Dead end. Click a path cell to undo from there."
      : reachedLast && path.length < total
        ? "You reached the last number too early — undo a few steps."
        : next
          ? `${path.length} of ${total} cells · next: ${next.value}`
          : `${path.length} of ${total} cells`;

  const polyline = path
    .map((cell) => `${(cell % size) + 0.5},${Math.floor(cell / size) + 0.5}`)
    .join(" ");

  return (
    <GameShell
      title="Zip"
      subtitle={
        <>
          {mode === "daily" ? `Daily puzzle · ${dateLabel}` : "Practice"}
          <span className="dot-separator">·</span>
          {DIFFICULTY_LABELS[activeDifficulty]}
          <span className="dot-separator">·</span>
          {size}×{size}
          <span className="dot-separator">·</span>
          {puzzle.numbers.length} checkpoints
        </>
      }
      helpTitle="How to play Zip"
      help={
        <>
          <p className="modal-lede">
            Draw one continuous line that fills the board and touches the numbers in order.
          </p>
          <ul className="modal-rules">
            <li>Start on 1 and finish on the highest number.</li>
            <li>Visit every cell exactly once — no gaps, no crossing yourself.</li>
            <li>Numbers must be reached in ascending order.</li>
            <li>Drag across cells, or tap them one after another.</li>
            <li>Click an earlier cell on the path to undo back to it.</li>
          </ul>
          <p className="modal-note">
            The line only moves up, down, left or right. A path that covers every cell but reaches
            the numbers out of order is not accepted.
          </p>
        </>
      }
    >
      <section className="board-panel" aria-label="Zip board">
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
            <span className={`timer ${solved ? "is-done" : ""}`}>{formatTime(seconds)}</span>
            <button className="btn btn-ghost btn-sm" type="button" onClick={restart}>
              Restart
            </button>
          </div>
        </div>

        {mode === "practice" ? (
          <div className="difficulty-row" role="group" aria-label="Difficulty">
            <span className="difficulty-label">Difficulty</span>
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
            className="zip-board"
            onPointerMove={onBoardPointerMove}
            role="group"
            aria-label={`Zip board, ${size} by ${size}`}
          >
            <div
              className="zip-cells"
              style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: total }, (_, index) => {
                const row = Math.floor(index / size);
                const col = index % size;
                const classes = ["zip-cell"];
                if (visited.has(index)) classes.push("is-visited");
                if (index === puzzle.numbers[0].index) classes.push("is-start");
                return (
                  <button
                    key={index}
                    type="button"
                    data-zip-cell={index}
                    className={classes.join(" ")}
                    aria-label={`Row ${row + 1}, column ${col + 1}`}
                    onPointerDown={(event) => onPointerDown(event, index)}
                    onClick={(event) => {
                      if (event.detail === 0) extend(index);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Backspace" || event.key === "Delete") {
                        event.preventDefault();
                        restart();
                      }
                    }}
                  />
                );
              })}
            </div>

            <svg
              className="zip-path"
              viewBox={`0 0 ${size} ${size}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {path.length > 1 ? (
                <polyline
                  points={polyline}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={0.17}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
            </svg>

            <div
              className="zip-numbers"
              style={{
                gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
              }}
              aria-hidden="true"
            >
              {puzzle.numbers.map((number) => (
                <span
                  key={number.value}
                  className={`zip-number ${next?.value === number.value ? "is-next" : ""} ${
                    visited.has(number.index) ? "is-done" : ""
                  }`}
                  style={{
                    gridColumn: (number.index % size) + 1,
                    gridRow: Math.floor(number.index / size) + 1,
                  }}
                >
                  {number.value}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div
          className={`board-status ${solved ? "is-win" : deadEnd ? "is-warn" : ""}`}
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
              A fresh Zip board every day. Practice mode has four sizes.
            </p>
          )}
        </div>
      </section>

      <aside className="game-side">
        <section className="panel">
          <div className="panel-head">
            <h2>Path</h2>
            <span className="panel-value">
              {path.length}/{total}
            </span>
          </div>
          <div
            className="progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={path.length}
            aria-label="Cells covered"
          >
            <span style={{ width: `${(path.length / total) * 100}%` }} />
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
              <dt>Checkpoints</dt>
              <dd>{puzzle.numbers.length}</dd>
            </div>
            <div>
              <dt>Next</dt>
              <dd>{next ? next.value : "—"}</dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <h2>Rules</h2>
          <ul className="rule-list">
            <li>Start on 1 and end on the highest number.</li>
            <li>Cover every cell exactly once.</li>
            <li>Numbers must be reached in ascending order.</li>
            <li>Drag across cells, or tap them one by one.</li>
            <li>Tap an earlier cell to undo back to it.</li>
          </ul>
        </section>
      </aside>

      {solved && !winDismissed ? (
        <Modal
          title="Path complete"
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
          <p className="win-time">{formatTime(seconds)}</p>
          <p className="modal-lede">One line, every cell, all {puzzle.numbers.length} numbers in order.</p>
          <p className="modal-note">
            {size}×{size} · {DIFFICULTY_LABELS[activeDifficulty]}
          </p>
        </Modal>
      ) : null}
    </GameShell>
  );
}
