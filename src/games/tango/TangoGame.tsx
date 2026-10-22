import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  EMPTY,
  MOON,
  SUN,
  findConflicts,
  generatePuzzle,
  isSolved,
  todayKey,
  type Difficulty,
  type Relation,
  type Sym,
} from "./engine";
import { ArrowLeftIcon, CrossBadge, EqualBadge, LockIcon, MoonIcon, SunIcon } from "../../components/icons";
import { Modal } from "../../components/Modal";
import { clearTangoProgress, formatTime, loadTangoProgress, saveTangoProgress } from "../../lib/storage";

type Mode = "daily" | "practice";

const DAILY_DIFFICULTY: Difficulty = "deadly";

function valueLabel(value: Sym): string {
  if (value === SUN) return "sun";
  if (value === MOON) return "moon";
  return "empty";
}

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 9);
}

export function TangoGame() {
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

  const [cells, setCells] = useState<Sym[]>(puzzle.givens);
  const [seconds, setSeconds] = useState(0);
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [winDismissed, setWinDismissed] = useState(false);
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const size = puzzle.size;
  const total = size * size;
  const won = useMemo(
    () => isSolved(size, cells, puzzle.relations),
    [size, cells, puzzle.relations],
  );
  const conflicts = useMemo(
    () => findConflicts(size, cells, puzzle.relations),
    [size, cells, puzzle.relations],
  );
  const filled = useMemo(() => cells.filter((value) => value !== EMPTY).length, [cells]);
  const lockedCount = useMemo(
    () => puzzle.givens.filter((value) => value !== EMPTY).length,
    [puzzle.givens],
  );

  /* Restore or reset progress whenever the puzzle changes. */
  useEffect(() => {
    const saved = loadTangoProgress(puzzle.id);
    if (saved) {
      const merged = puzzle.givens.map((given, i) =>
        given !== EMPTY ? given : ((saved.cells[i] ?? EMPTY) as Sym),
      );
      setCells(merged);
      setSeconds(saved.seconds);
      setWinDismissed(saved.solved);
    } else {
      setCells(puzzle.givens.slice());
      setSeconds(0);
      setWinDismissed(false);
    }
    setHydratedId(puzzle.id);
    setFocused(null);
    setHover(null);
  }, [puzzle]);

  useEffect(() => {
    if (won) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [won, puzzle.id]);

  useEffect(() => {
    if (hydratedId !== puzzle.id) return;
    saveTangoProgress(puzzle.id, { cells, seconds, solved: won });
  }, [cells, seconds, won, puzzle.id, hydratedId]);

  const setValue = useCallback(
    (index: number, value: Sym) => {
      if (won || puzzle.givens[index] !== EMPTY) return;
      setCells((previous) => {
        if (previous[index] === value) return previous;
        const next = previous.slice();
        next[index] = value;
        return next;
      });
    },
    [puzzle.givens, won],
  );

  const cycleValue = useCallback(
    (index: number) => {
      if (won || puzzle.givens[index] !== EMPTY) return;
      setCells((previous) => {
        const next = previous.slice();
        const current = next[index];
        next[index] = current === EMPTY ? SUN : current === SUN ? MOON : EMPTY;
        return next;
      });
    },
    [puzzle.givens, won],
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
        case "s":
        case "S":
          event.preventDefault();
          setValue(index, SUN);
          return;
        case "2":
        case "m":
        case "M":
          event.preventDefault();
          setValue(index, MOON);
          return;
        case "0":
        case "Backspace":
        case "Delete":
          event.preventDefault();
          setValue(index, EMPTY);
          return;
        default:
      }
    },
    [moveFocus, setValue],
  );

  const restart = () => {
    setCells(puzzle.givens.slice());
    setSeconds(0);
    setWinDismissed(false);
    setFocused(null);
    clearTangoProgress(puzzle.id);
  };

  const newPracticePuzzle = () => {
    setPracticeSeed(randomSeed());
    setWinDismissed(false);
  };

  const relationMaps = useMemo(() => {
    const right = new Map<number, Relation>();
    const down = new Map<number, Relation>();
    for (const relation of puzzle.relations) {
      if (relation.b === relation.a + 1) right.set(relation.a, relation);
      else down.set(relation.a, relation);
    }
    return { right, down };
  }, [puzzle.relations]);

  const referenceMatch = useMemo(
    () => cells.every((value, i) => value === puzzle.solution[i]),
    [cells, puzzle.solution],
  );

  const status = won
    ? referenceMatch
      ? "Solved — that is the exact solution."
      : "Solved — a valid arrangement (this puzzle has several)."
    : conflicts.size > 0
      ? `${conflicts.size} cell${conflicts.size === 1 ? "" : "s"} break a rule — they are highlighted.`
      : filled === 0
        ? "Tap a cell to place a sun or moon. Locked cells cannot be changed."
        : "No conflicts so far. Keep balancing.";

  const dateLabel = new Date(`${dailySeed}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <div className="app-shell game-shell">
      <header className="game-header">
        <a className="back-link" href="#/">
          <ArrowLeftIcon className="back-icon" />
          All games
        </a>
        <div className="game-heading">
          <h1>Tango</h1>
          <p>
            {mode === "daily" ? `Daily puzzle · ${dateLabel}` : "Practice"}
            <span className="dot-separator">·</span>
            {DIFFICULTY_LABELS[activeDifficulty]}
            <span className="dot-separator">·</span>
            {puzzle.solutionCount === 1
              ? "1 solution"
              : `${puzzle.solutionCount} solutions`}
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => setHelpOpen(true)}>
          How to play
        </button>
      </header>

      <div className="game-layout">
        <section className="board-panel" aria-label="Puzzle board">
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
              <span className={`timer ${won ? "is-done" : ""}`} aria-label={`Elapsed time ${formatTime(seconds)}`}>
                {formatTime(seconds)}
              </span>
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
              className="tango-board"
              style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
              role="group"
              aria-label={`Tango board, ${size} by ${size}`}
            >
              {cells.map((value, index) => {
                const row = Math.floor(index / size);
                const col = index % size;
                const locked = puzzle.givens[index] !== EMPTY;
                const conflict = conflicts.has(index);
                const peer =
                  hover !== null &&
                  hover !== index &&
                  (Math.floor(hover / size) === row || (hover % size) === col);

                const classes = ["tango-cell"];
                if (value !== EMPTY) classes.push("is-filled", value === SUN ? "is-sun" : "is-moon");
                if (locked) classes.push("is-locked");
                if (conflict) classes.push("is-conflict");
                if (peer) classes.push("is-peer");
                if (won) classes.push("is-solved");

                const rightRelation = relationMaps.right.get(index);
                const downRelation = relationMaps.down.get(index);

                return (
                  <div className="tango-slot" key={index}>
                    <button
                      type="button"
                      ref={(element) => {
                        cellRefs.current[index] = element;
                      }}
                      className={classes.join(" ")}
                      style={{ "--cell-delay": `${(row + col) * 32}ms` } as CSSProperties}
                      tabIndex={focused === index || (focused === null && index === 0) ? 0 : -1}
                      aria-label={`Row ${row + 1}, column ${col + 1}: ${
                        locked ? "locked " : ""
                      }${valueLabel(value)}`}
                      aria-readonly={locked}
                      aria-invalid={conflict || undefined}
                      title={locked ? "Locked clue — this cell cannot be changed" : undefined}
                      onFocus={() => setFocused(index)}
                      onMouseEnter={() => setHover(index)}
                      onMouseLeave={() => setHover(null)}
                      onClick={() => {
                        setFocused(index);
                        cycleValue(index);
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setValue(index, EMPTY);
                      }}
                      onKeyDown={(event) => onCellKeyDown(event, index)}
                    >
                      {value === SUN ? <SunIcon className="cell-icon" /> : null}
                      {value === MOON ? <MoonIcon className="cell-icon" /> : null}
                      {locked ? <LockIcon className="lock-badge" /> : null}
                    </button>
                    {rightRelation ? (
                      <span
                        className={`tango-rel rel-right ${rightRelation.kind}`}
                        aria-hidden="true"
                        title={
                          rightRelation.kind === "same"
                            ? "These two cells must match"
                            : "These two cells must differ"
                        }
                      >
                        {rightRelation.kind === "same" ? <EqualBadge /> : <CrossBadge />}
                      </span>
                    ) : null}
                    {downRelation ? (
                      <span
                        className={`tango-rel rel-down ${downRelation.kind}`}
                        aria-hidden="true"
                        title={
                          downRelation.kind === "same"
                            ? "These two cells must match"
                            : "These two cells must differ"
                        }
                      >
                        {downRelation.kind === "same" ? <EqualBadge /> : <CrossBadge />}
                      </span>
                    ) : null}
                  </div>
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
                A fresh Tango every day. Solved today? Practice mode is unlimited.
              </p>
            )}
          </div>
        </section>

        <aside className="game-side">
          <section className="panel">
            <div className="panel-head">
              <h2>Progress</h2>
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
                <dt>Locked cells</dt>
                <dd>{lockedCount}</dd>
              </div>
              <div>
                <dt>Links</dt>
                <dd>{puzzle.relations.length}</dd>
              </div>
              <div>
                <dt>Solutions</dt>
                <dd>{puzzle.solutionCount}</dd>
              </div>
            </dl>
          </section>

          <section className="panel">
            <h2>Rules</h2>
            <ul className="rule-list">
              <li>
                <span className="rule-glyph sun">
                  <SunIcon />
                </span>
                <span className="rule-glyph moon">
                  <MoonIcon />
                </span>
                Fill every cell with a sun or a moon.
              </li>
              <li>Each row and column needs exactly three of each.</li>
              <li>Never place three identical symbols in a line.</li>
              <li>
                <EqualBadge /> linked cells must match, <CrossBadge /> must differ.
              </li>
              <li>Cells with a small lock are fixed clues.</li>
            </ul>
            <button className="text-button" type="button" onClick={() => setHelpOpen(true)}>
              Read the full rules
            </button>
          </section>
        </aside>
      </div>

      <footer className="site-footer">
        <span>Dyno MiniGames</span>
        <span className="footer-sep">·</span>
        <span>Progress is saved in this browser.</span>
      </footer>

      {helpOpen ? (
        <Modal title="How to play Tango" onClose={() => setHelpOpen(false)}>
          <p className="modal-lede">
            Fill the grid so every cell is a sun or a moon — and no line breaks the rules.
          </p>
          <ul className="modal-rules">
            <li>
              Every row and every column contains <strong>three suns</strong> and{" "}
              <strong>three moons</strong>.
            </li>
            <li>Three identical symbols may never sit next to each other in a row or column.</li>
            <li>
              Cells joined by <span className="inline-badge"><EqualBadge /></span> must be the
              same; cells joined by <span className="inline-badge"><CrossBadge /></span> must
              differ.
            </li>
            <li>
              Cells marked with a <strong>small lock</strong> are pre-filled clues — they cannot be
              edited.
            </li>
          </ul>
          <p className="modal-note">
            Difficulty is set by how many valid grids a puzzle has: Easy accepts many, Deadly is
            guaranteed to have exactly one. Any valid grid wins.
          </p>
          <div className="modal-actions">
            <button className="btn btn-primary" type="button" onClick={() => setHelpOpen(false)}>
              Got it
            </button>
          </div>
        </Modal>
      ) : null}

      {won && !winDismissed ? (
        <Modal
          title={referenceMatch ? "Perfect balance" : "Balanced"}
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
            <SunIcon />
            <MoonIcon />
          </div>
          <p className="win-time">{formatTime(seconds)}</p>
          <p className="modal-lede">
            {referenceMatch
              ? "You found the intended solution."
              : `Any valid grid wins — this puzzle has ${puzzle.solutionCount} of them.`}
          </p>
          <p className="modal-note">
            {DIFFICULTY_LABELS[mode === "daily" ? DAILY_DIFFICULTY : difficulty]} ·{" "}
            {lockedCount} locked cells · {puzzle.relations.length} links
          </p>
        </Modal>
      ) : null}
    </div>
  );
}
