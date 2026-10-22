import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { GameShell } from "../../components/GameShell";
import { Modal } from "../../components/Modal";
import { clearGameProgress, formatTime, loadGameJson, saveGameJson } from "../../lib/storage";
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  areAdjacent,
  generatePuzzle,
  isSolved,
  isWord,
  openSlot,
  pathToWord,
  todayKey,
  usedCells as collectUsed,
  type Difficulty,
  type WendWord,
} from "./engine";

type Mode = "daily" | "practice";

const DAILY_DIFFICULTY: Difficulty = "medium";

interface SavedWend {
  slots: Array<WendWord | null>;
  seconds: number;
  solved: boolean;
}

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 9);
}

export function WendGame() {
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

  const [slots, setSlots] = useState<Array<WendWord | null>>(() =>
    puzzle.lengths.map(() => null),
  );
  const [path, setPath] = useState<number[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [winDismissed, setWinDismissed] = useState(false);
  const draggingRef = useRef(false);

  const solved = useMemo(() => isSolved(puzzle.lengths, slots), [puzzle.lengths, slots]);
  const used = useMemo(() => collectUsed(slots), [slots]);
  const foundCount = slots.filter(Boolean).length;

  useEffect(() => {
    const saved = loadGameJson<SavedWend>("wend", puzzle.id);
    const restored = puzzle.lengths.map((length, index) => {
      const entry = saved?.slots?.[index];
      if (!entry || !Array.isArray(entry.cells) || typeof entry.word !== "string") return null;
      if (entry.cells.length !== length) return null;
      const unique = new Set(entry.cells);
      if (unique.size !== length) return null;
      if (entry.cells.some((cell) => !Number.isInteger(cell) || cell < 0 || cell >= total)) return null;
      for (let k = 1; k < entry.cells.length; k++) {
        if (!areAdjacent(size, entry.cells[k - 1], entry.cells[k])) return null;
      }
      if (pathToWord(puzzle.grid, entry.cells) !== entry.word.toLowerCase()) return null;
      if (!isWord(entry.word)) return null;
      return { word: entry.word.toLowerCase(), cells: entry.cells };
    });

    // Drop overlapping restores.
    const seen = new Set<number>();
    const clean = restored.map((entry) => {
      if (!entry) return null;
      if (entry.cells.some((cell) => seen.has(cell))) return null;
      entry.cells.forEach((cell) => seen.add(cell));
      return entry;
    });

    setSlots(clean);
    setPath([]);
    setMessage(null);
    setSeconds(typeof saved?.seconds === "number" ? Math.max(0, saved.seconds) : 0);
    setWinDismissed(saved?.solved === true);
    setHydratedId(puzzle.id);
  }, [puzzle, size, total]);

  useEffect(() => {
    if (solved) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [solved, puzzle.id]);

  useEffect(() => {
    if (hydratedId !== puzzle.id) return;
    saveGameJson<SavedWend>("wend", puzzle.id, { slots, seconds, solved });
  }, [slots, seconds, solved, puzzle.id, hydratedId]);

  useEffect(() => {
    const stop = () => {
      draggingRef.current = false;
    };
    window.addEventListener("pointercancel", stop);
    return () => window.removeEventListener("pointercancel", stop);
  }, []);

  const extend = useCallback(
    (cell: number) => {
      if (used.has(cell)) return;
      setPath((previous) => {
        if (previous.length === 0) return [cell];
        const last = previous[previous.length - 1];
        if (cell === last) return previous;
        const at = previous.indexOf(cell);
        if (at >= 0) return previous.slice(0, at + 1);
        if (!areAdjacent(size, last, cell)) return previous;
        return [...previous, cell];
      });
    },
    [size, used],
  );

  const submitWord = useCallback(() => {
    if (solved || path.length < 2) return;
    if (!puzzle.lengths.includes(path.length)) {
      setMessage(`No slot uses ${path.length} letters — keep tracing.`);
      return;
    }
    const word = pathToWord(puzzle.grid, path);
    if (!isWord(word)) {
      setMessage(`"${word.toUpperCase()}" is not in the word list.`);
      return;
    }
    const slot = openSlot(puzzle.lengths, slots, path.length);
    if (slot < 0) {
      setMessage(`Every ${path.length}-letter slot is already filled.`);
      return;
    }
    setSlots((previous) => {
      const next = previous.slice();
      next[slot] = { word, cells: path };
      return next;
    });
    setPath([]);
    setMessage(null);
  }, [path, puzzle.grid, puzzle.lengths, slots, solved]);

  const clearTrace = () => {
    setPath([]);
    setMessage(null);
  };

  const onCellPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, cell: number) => {
    if (solved) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    draggingRef.current = true;
    extend(cell);
  };

  const onBoardPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || solved) return;
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const cell = element?.closest<HTMLElement>("[data-wend-cell]");
    if (cell) extend(Number(cell.dataset.wendCell));
  };

  const onBoardPointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    submitWord();
  };

  const restart = () => {
    setSlots(puzzle.lengths.map(() => null));
    setPath([]);
    setSeconds(0);
    setMessage(null);
    setWinDismissed(false);
    clearGameProgress("wend", puzzle.id);
  };

  const newPracticePuzzle = () => {
    setPracticeSeed(randomSeed());
    setWinDismissed(false);
  };

  const dateLabel = new Date(`${dailySeed}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  const polyline = path
    .map((cell) => `${(cell % size) + 0.5},${Math.floor(cell / size) + 0.5}`)
    .join(" ");

  const status = solved
    ? "Solved — every letter belongs to a word."
    : message
      ? message
      : path.length > 0
        ? `${path.length} letters traced · release or press Submit.`
        : `${foundCount} of ${puzzle.lengths.length} words · ${used.size} of ${total} letters used.`;

  return (
    <GameShell
      title="Wend"
      subtitle={
        <>
          {mode === "daily" ? `Daily puzzle · ${dateLabel}` : "Practice"}
          <span className="dot-separator">·</span>
          {DIFFICULTY_LABELS[activeDifficulty]}
          <span className="dot-separator">·</span>
          {size}×{size}
          <span className="dot-separator">·</span>
          {puzzle.lengths.length} words
        </>
      }
      helpTitle="How to play Wend"
      help={
        <>
          <p className="modal-lede">
            Trace hidden words through the grid. Every letter is used exactly once.
          </p>
          <ul className="modal-rules">
            <li>Words run through horizontally or vertically adjacent cells.</li>
            <li>The lengths of the hidden words are shown under the board.</li>
            <li>A traced word fills the first open slot of the same length.</li>
            <li>Drag across cells, or tap them one by one and press Submit.</li>
            <li>Tap an earlier cell to undo the trace back to it.</li>
          </ul>
          <p className="modal-note">
            Any valid word of the right length is accepted — you do not have to match the
            generator's own words.
          </p>
        </>
      }
    >
      <section className="board-panel" aria-label="Wend board">
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
            className="wend-board"
            onPointerMove={onBoardPointerMove}
            onPointerUp={onBoardPointerUp}
            role="group"
            aria-label={`Wend board, ${size} by ${size}`}
          >
            <div
              className="wend-cells"
              style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
            >
              {puzzle.grid.map((letter, cell) => (
                <button
                  key={cell}
                  type="button"
                  data-wend-cell={cell}
                  className={`wend-cell ${used.has(cell) ? "is-used" : ""} ${
                    path.includes(cell) ? "is-traced" : ""
                  }`}
                  aria-label={`Row ${Math.floor(cell / size) + 1}, column ${(cell % size) + 1}: ${letter}`}
                  onPointerDown={(event) => onCellPointerDown(event, cell)}
                  onClick={(event) => {
                    if (event.detail === 0) extend(cell);
                  }}
                />
              ))}
            </div>

            <div
              className="wend-letters"
              style={{
                gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
              }}
              aria-hidden="true"
            >
              {puzzle.grid.map((letter, cell) => (
                <span key={cell} className={`wend-letter ${used.has(cell) ? "is-used" : ""}`}>
                  {letter}
                </span>
              ))}
            </div>

            <svg
              className="wend-path"
              viewBox={`0 0 ${size} ${size}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {path.length > 1 ? (
                <polyline
                  points={polyline}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={0.16}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
            </svg>
          </div>
        </div>

        <div className="wend-slots" role="group" aria-label="Word slots">
          {puzzle.lengths.map((length, index) => {
            const entry = slots[index];
            return (
              <div
                key={index}
                className={`wend-slot ${entry ? "is-filled" : ""} ${
                  path.length === length && !entry ? "is-target" : ""
                }`}
              >
                {entry ? entry.word.toUpperCase() : `${length}`}
                <small>{entry ? "found" : "letters"}</small>
              </div>
            );
          })}
        </div>

        <div className="wend-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={submitWord}
            disabled={solved || path.length < 2}
          >
            Submit word
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={clearTrace}
            disabled={solved || path.length === 0}
          >
            Clear trace
          </button>
        </div>

        <div
          className={`board-status ${solved ? "is-win" : message ? "is-warn" : ""}`}
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
              A fresh Wend board every day. Practice mode has four difficulty levels.
            </p>
          )}
        </div>
      </section>

      <aside className="game-side">
        <section className="panel">
          <div className="panel-head">
            <h2>Words</h2>
            <span className="panel-value">
              {foundCount}/{puzzle.lengths.length}
            </span>
          </div>
          <div
            className="progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={puzzle.lengths.length}
            aria-valuenow={foundCount}
            aria-label="Words found"
          >
            <span style={{ width: `${(foundCount / puzzle.lengths.length) * 100}%` }} />
          </div>
          <dl className="stat-list">
            <div>
              <dt>Time</dt>
              <dd>{formatTime(seconds)}</dd>
            </div>
            <div>
              <dt>Letters used</dt>
              <dd>
                {used.size}/{total}
              </dd>
            </div>
            <div>
              <dt>Words</dt>
              <dd>{puzzle.lengths.length}</dd>
            </div>
            <div>
              <dt>Grid</dt>
              <dd>
                {size}×{size}
              </dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <h2>Rules</h2>
          <ul className="rule-list">
            <li>Connect letters up, down, left or right.</li>
            <li>Every letter belongs to exactly one word.</li>
            <li>Slots show the length of each hidden word.</li>
            <li>Drag to trace, or tap letters then Submit.</li>
            <li>Tap back along the trace to undo.</li>
          </ul>
        </section>
      </aside>

      {solved && !winDismissed ? (
        <Modal
          title="Every letter placed"
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
          <div className="win-ladder" aria-hidden="true">
            {slots.map((entry, index) => (
              <span key={index}>{entry ? entry.word.toUpperCase() : ""}</span>
            ))}
          </div>
          <p className="modal-lede">All {puzzle.lengths.length} words found, every letter used.</p>
        </Modal>
      ) : null}
    </GameShell>
  );
}
