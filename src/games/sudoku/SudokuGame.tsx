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
import { clearGameProgress, formatTime, loadGameJson, saveGameJson } from "../../lib/storage";
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  DIGITS,
  SIZE,
  boxIndex,
  findConflicts,
  generatePuzzle,
  isSolved,
  todayKey,
  type Difficulty,
} from "./engine";

type Mode = "daily" | "practice";

const DAILY_DIFFICULTY: Difficulty = "medium";

interface SavedSudoku {
  cells: number[];
  seconds: number;
  solved: boolean;
}

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 9);
}

export function SudokuGame() {
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
  const total = SIZE * SIZE;
  const clueCount = useMemo(() => puzzle.givens.filter(Boolean).length, [puzzle.givens]);

  const [cells, setCells] = useState<number[]>(() => puzzle.givens.slice());
  const [seconds, setSeconds] = useState(0);
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [winDismissed, setWinDismissed] = useState(false);
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const won = useMemo(() => isSolved(cells), [cells]);
  const conflicts = useMemo(() => findConflicts(cells), [cells]);
  const filled = useMemo(() => cells.filter(Boolean).length, [cells]);

  useEffect(() => {
    const saved = loadGameJson<SavedSudoku>("sudoku", puzzle.id);
    const restored = puzzle.givens.map((given, index) => {
      if (given) return given;
      const value = saved?.cells?.[index];
      return value && value >= 1 && value <= SIZE ? value : 0;
    });
    setCells(restored);
    setSeconds(typeof saved?.seconds === "number" ? Math.max(0, saved.seconds) : 0);
    setWinDismissed(saved?.solved === true);
    setHydratedId(puzzle.id);
    setSelected(null);
  }, [puzzle]);

  useEffect(() => {
    if (won) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [won, puzzle.id]);

  useEffect(() => {
    if (hydratedId !== puzzle.id) return;
    saveGameJson<SavedSudoku>("sudoku", puzzle.id, { cells, seconds, solved: won });
  }, [cells, seconds, won, puzzle.id, hydratedId]);

  const place = useCallback(
    (value: number) => {
      if (selected === null || won) return;
      if (puzzle.givens[selected] !== 0) return;
      setCells((previous) => {
        const next = previous.slice();
        next[selected] = previous[selected] === value ? 0 : value;
        return next;
      });
    },
    [puzzle.givens, selected, won],
  );

  const moveSelection = useCallback((index: number, deltaRow: number, deltaCol: number) => {
    const row = Math.floor(index / SIZE) + deltaRow;
    const col = (index % SIZE) + deltaCol;
    if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return;
    const next = row * SIZE + col;
    setSelected(next);
    cellRefs.current[next]?.focus();
  }, []);

  const onCellKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          moveSelection(index, -1, 0);
          return;
        case "ArrowDown":
          event.preventDefault();
          moveSelection(index, 1, 0);
          return;
        case "ArrowLeft":
          event.preventDefault();
          moveSelection(index, 0, -1);
          return;
        case "ArrowRight":
          event.preventDefault();
          moveSelection(index, 0, 1);
          return;
        case "Backspace":
        case "Delete":
        case "0":
          event.preventDefault();
          if (puzzle.givens[index] === 0) {
            setCells((previous) => {
              const next = previous.slice();
              next[index] = 0;
              return next;
            });
          }
          return;
        default:
          if (/^[1-6]$/.test(event.key) && puzzle.givens[index] === 0) {
            event.preventDefault();
            const value = Number(event.key);
            setCells((previous) => {
              const next = previous.slice();
              next[index] = previous[index] === value ? 0 : value;
              return next;
            });
          }
      }
    },
    [moveSelection, puzzle.givens],
  );

  const restart = () => {
    setCells(puzzle.givens.slice());
    setSeconds(0);
    setWinDismissed(false);
    setSelected(null);
    clearGameProgress("sudoku", puzzle.id);
  };

  const newPracticePuzzle = () => {
    setPracticeSeed(randomSeed());
    setWinDismissed(false);
  };

  const dateLabel = new Date(`${dailySeed}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  const selectedValue = selected !== null ? cells[selected] : 0;
  const selectedBox = selected !== null ? boxIndex(Math.floor(selected / SIZE), selected % SIZE) : -1;

  const status = won
    ? "Solved — every row, column and box holds 1 to 6."
    : conflicts.size > 0
      ? `${conflicts.size} cell${conflicts.size === 1 ? "" : "s"} repeat a number in a row, column or box.`
      : selected === null
        ? "Pick a cell, then a number."
        : `${filled} of ${total} cells filled.`;

  return (
    <GameShell
      title="Mini Sudoku"
      subtitle={
        <>
          {mode === "daily" ? `Daily puzzle · ${dateLabel}` : "Practice"}
          <span className="dot-separator">·</span>
          {DIFFICULTY_LABELS[activeDifficulty]}
          <span className="dot-separator">·</span>
          6×6
          <span className="dot-separator">·</span>
          {clueCount} clues
        </>
      }
      helpTitle="How to play Mini Sudoku"
      help={
        <>
          <p className="modal-lede">
            Fill the 6×6 grid so every row, column and 2×3 box contains 1 to 6 exactly once.
          </p>
          <ul className="modal-rules">
            <li>Each row uses all six digits exactly once.</li>
            <li>Each column does the same.</li>
            <li>
              Each of the six <strong>2×3 boxes</strong> does the same.
            </li>
            <li>Grey digits are given clues and cannot change.</li>
            <li>Tap a cell and then a number; tap the same number again to clear it.</li>
          </ul>
          <p className="modal-note">
            Every puzzle is generated with a single solution, verified by the solver.
          </p>
        </>
      }
    >
      <section className="board-panel" aria-label="Mini Sudoku board">
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
            <span className={`timer ${won ? "is-done" : ""}`}>{formatTime(seconds)}</span>
            <button className="btn btn-ghost btn-sm" type="button" onClick={restart}>
              Restart
            </button>
          </div>
        </div>

        {mode === "practice" ? (
          <div className="difficulty-row" role="group" aria-label="Difficulty">
            <span className="difficulty-label">Clues</span>
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
            className="sudoku-board"
            style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
            role="group"
            aria-label="Mini Sudoku grid"
          >
            {cells.map((value, index) => {
              const row = Math.floor(index / SIZE);
              const col = index % SIZE;
              const box = boxIndex(row, col);
              const given = puzzle.givens[index] !== 0;
              const conflict = conflicts.has(index);
              const sameRow = selected !== null && Math.floor(selected / SIZE) === row;
              const sameCol = selected !== null && selected % SIZE === col;
              const sameBox = selected !== null && selectedBox === box;
              const peer = selected !== null && index !== selected && (sameRow || sameCol || sameBox);
              const sameValue =
                selected !== null && index !== selected && selectedValue > 0 && value === selectedValue;

              const classes = ["sudoku-cell"];
              if (col === 2) classes.push("box-r");
              if (row % 2 === 1 && row < SIZE - 1) classes.push("box-b");
              if (given) classes.push("is-given");
              if (peer) classes.push("is-peer");
              if (sameValue) classes.push("is-same");
              if (conflict) classes.push("is-conflict");
              if (selected === index) classes.push("is-selected");

              return (
                <button
                  key={index}
                  type="button"
                  ref={(element) => {
                    cellRefs.current[index] = element;
                  }}
                  className={classes.join(" ")}
                  tabIndex={selected === index || (selected === null && index === 0) ? 0 : -1}
                  aria-label={`Row ${row + 1}, column ${col + 1}: ${value || "empty"}${
                    given ? " (clue)" : ""
                  }`}
                  aria-invalid={conflict || undefined}
                  onFocus={() => setSelected(index)}
                  onClick={() => setSelected(index)}
                  onKeyDown={(event) => onCellKeyDown(event, index)}
                >
                  {value || ""}
                </button>
              );
            })}
          </div>
        </div>

        <div className="sudoku-pad" role="group" aria-label="Number pad">
          {DIGITS.map((digit) => {
            const remaining = SIZE - cells.filter((value) => value === digit).length;
            return (
              <button
                key={digit}
                type="button"
                className={`sudoku-key ${remaining === 0 ? "is-done" : ""}`}
                aria-label={`Place ${digit}, ${remaining} left`}
                onClick={() => place(digit)}
              >
                {digit}
              </button>
            );
          })}
          <button
            type="button"
            className="sudoku-key is-erase"
            aria-label="Clear the selected cell"
            onClick={() => place(0)}
          >
            ⌫
          </button>
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
            <p className="daily-note">A fresh Mini Sudoku every day. Fewer clues, harder board.</p>
          )}
        </div>
      </section>

      <aside className="game-side">
        <section className="panel">
          <div className="panel-head">
            <h2>Grid</h2>
            <span className="panel-value">
              {filled}/{total}
            </span>
          </div>
          <div
            className="progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={filled}
            aria-label="Cells filled"
          >
            <span style={{ width: `${(filled / total) * 100}%` }} />
          </div>
          <dl className="stat-list">
            <div>
              <dt>Time</dt>
              <dd>{formatTime(seconds)}</dd>
            </div>
            <div>
              <dt>Clues</dt>
              <dd>{clueCount}</dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>6×6</dd>
            </div>
            <div>
              <dt>Boxes</dt>
              <dd>2×3</dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <h2>Rules</h2>
          <ul className="rule-list">
            <li>Every row holds 1–6 exactly once.</li>
            <li>Every column holds 1–6 exactly once.</li>
            <li>Every 2×3 box holds 1–6 exactly once.</li>
            <li>Grey digits are clues and cannot change.</li>
            <li>Tap the same number again to clear a cell.</li>
          </ul>
        </section>
      </aside>

      {won && !winDismissed ? (
        <Modal
          title="Grid complete"
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
          <p className="modal-lede">Every row, column and box has 1 to 6.</p>
          <p className="modal-note">
            6×6 · {clueCount} clues · {DIFFICULTY_LABELS[activeDifficulty]}
          </p>
        </Modal>
      ) : null}
    </GameShell>
  );
}
