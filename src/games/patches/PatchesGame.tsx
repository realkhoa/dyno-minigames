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
  cluesInside,
  coveredArea,
  generatePuzzle,
  normalizeRect,
  overlaps,
  todayKey,
  type Difficulty,
  type PlacedPatch,
} from "./engine";

type Mode = "daily" | "practice";

const DAILY_DIFFICULTY: Difficulty = "medium";

const PATCH_FILLS = [
  "rgba(143, 161, 184, 0.24)",
  "rgba(200, 164, 92, 0.22)",
  "rgba(126, 200, 176, 0.19)",
  "rgba(178, 143, 184, 0.23)",
  "rgba(143, 184, 200, 0.22)",
  "rgba(200, 143, 122, 0.20)",
  "rgba(150, 170, 130, 0.21)",
  "rgba(170, 150, 200, 0.21)",
  "rgba(120, 160, 200, 0.22)",
];

interface SavedPatches {
  patches: PlacedPatch[];
  seconds: number;
  solved: boolean;
}

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 9);
}

export function PatchesGame() {
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

  const [patches, setPatches] = useState<PlacedPatch[]>([]);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  const [winDismissed, setWinDismissed] = useState(false);
  const dragging = useRef(false);

  const covered = useMemo(() => coveredArea(patches), [patches]);
  const solved = covered === total;

  useEffect(() => {
    const saved = loadGameJson<SavedPatches>("patches", puzzle.id);
    const restored = Array.isArray(saved?.patches)
      ? saved.patches.filter((patch) => {
          if (!patch || typeof patch !== "object") return false;
          const { x, y, w, h } = patch;
          if (![x, y, w, h].every((value) => Number.isInteger(value))) return false;
          if (w <= 0 || h <= 0 || x < 0 || y < 0) return false;
          if (x + w > size || y + h > size) return false;
          return true;
        })
      : [];
    // Drop overlaps from a corrupted save.
    const clean: PlacedPatch[] = [];
    for (const patch of restored) {
      if (clean.some((other) => overlaps(other, patch))) continue;
      clean.push(patch);
    }
    setPatches(clean);
    setSeconds(typeof saved?.seconds === "number" ? Math.max(0, saved.seconds) : 0);
    setWinDismissed(saved?.solved === true);
    setHydratedId(puzzle.id);
    setAnchor(null);
    setHover(null);
  }, [puzzle, size]);

  useEffect(() => {
    if (solved) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [solved, puzzle.id]);

  useEffect(() => {
    if (hydratedId !== puzzle.id) return;
    saveGameJson<SavedPatches>("patches", puzzle.id, { patches, seconds, solved });
  }, [patches, seconds, solved, puzzle.id, hydratedId]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 3200);
    return () => window.clearTimeout(timer);
  }, [message]);

  const commit = useCallback(
    (from: number, to: number) => {
      const rect = normalizeRect(from, to, size);
      const area = rect.w * rect.h;
      if (area < 2) {
        setMessage("A patch needs at least two cells.");
        return;
      }
      if (patches.some((patch) => overlaps(patch, rect))) {
        setMessage("That space is already covered.");
        return;
      }
      const inside = cluesInside(puzzle, rect);
      if (inside.length !== 1) {
        setMessage(
          inside.length === 0
            ? "Every patch needs exactly one clue inside it."
            : "A patch can only hold one clue.",
        );
        return;
      }
      const clue = inside[0];
      if (clue.area !== area) {
        setMessage(`That clue needs ${clue.area} cells, but this rectangle has ${area}.`);
        return;
      }
      setPatches((previous) => [
        ...previous,
        { x: rect.x, y: rect.y, w: rect.w, h: rect.h, clueX: clue.x, clueY: clue.y },
      ]);
      setMessage(null);
    },
    [patches, puzzle, size],
  );

  const patchAt = useCallback(
    (index: number): PlacedPatch | null => {
      const x = index % size;
      const y = Math.floor(index / size);
      return (
        patches.find(
          (patch) => x >= patch.x && x < patch.x + patch.w && y >= patch.y && y < patch.y + patch.h,
        ) ?? null
      );
    },
    [patches, size],
  );

  const tap = useCallback(
    (index: number) => {
      if (solved) return;
      const existing = patchAt(index);
      if (existing) {
        setPatches((previous) => previous.filter((patch) => patch !== existing));
        setAnchor(null);
        setHover(null);
        setMessage(null);
        return;
      }
      if (anchor === null) {
        setAnchor(index);
        return;
      }
      if (anchor === index) {
        setAnchor(null);
        return;
      }
      commit(anchor, index);
      setAnchor(null);
      setHover(null);
    },
    [anchor, commit, patchAt, solved],
  );

  const onCellPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, index: number) => {
    if (solved) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragging.current = true;
    setHover(index);
    tap(index);
  };

  const onBoardPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current || anchor === null || solved) return;
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const cell = element?.closest<HTMLElement>("[data-patch-cell]");
    if (cell) setHover(Number(cell.dataset.patchCell));
  };

  const onBoardPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (anchor !== null && hover !== null && hover !== anchor) {
      commit(anchor, hover);
      setAnchor(null);
    }
    setHover(null);
  };

  const restart = () => {
    setPatches([]);
    setSeconds(0);
    setWinDismissed(false);
    setAnchor(null);
    setHover(null);
    setMessage(null);
    clearGameProgress("patches", puzzle.id);
  };

  const newPracticePuzzle = () => {
    setPracticeSeed(randomSeed());
    setWinDismissed(false);
  };

  const dateLabel = new Date(`${dailySeed}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  const preview = useMemo(() => {
    if (anchor === null) return null;
    const target = hover ?? anchor;
    return normalizeRect(anchor, target, size);
  }, [anchor, hover, size]);

  const usedClues = useMemo(
    () => new Set(patches.map((patch) => `${patch.clueX},${patch.clueY}`)),
    [patches],
  );

  const status = solved
    ? "Solved — every cell belongs to exactly one patch."
    : message
      ? message
      : anchor !== null
        ? "Drag to the opposite corner, or tap another cell, to place the patch."
        : `${patches.length} of ${puzzle.clues.length} patches · ${covered} of ${total} cells covered.`;

  return (
    <GameShell
      title="Patches"
      subtitle={
        <>
          {mode === "daily" ? `Daily puzzle · ${dateLabel}` : "Practice"}
          <span className="dot-separator">·</span>
          {DIFFICULTY_LABELS[activeDifficulty]}
          <span className="dot-separator">·</span>
          {size}×{size}
          <span className="dot-separator">·</span>
          {puzzle.clues.length} clues
        </>
      }
      helpTitle="How to play Patches"
      help={
        <>
          <p className="modal-lede">
            Divide the grid into rectangles. Every rectangle holds exactly one number, and that
            number is how many cells the rectangle must contain.
          </p>
          <ul className="modal-rules">
            <li>Every clue sits inside its own patch.</li>
            <li>The patch area must equal the clue number.</li>
            <li>Patches may not overlap, and no cell may be left out.</li>
            <li>Drag from one corner to the other, or tap two opposite corners.</li>
            <li>Tap a placed patch to remove it.</li>
          </ul>
          <p className="modal-note">
            Rectangles and squares both count. Any complete, valid partition solves the board.
          </p>
        </>
      }
    >
      <section className="board-panel" aria-label="Patches board">
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
            className="patches-board"
            onPointerMove={onBoardPointerMove}
            onPointerUp={onBoardPointerUp}
            onPointerCancel={onBoardPointerUp}
            role="group"
            aria-label={`Patches board, ${size} by ${size}`}
          >
            <div
              className="patches-cells"
              style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: total }, (_, index) => {
                const row = Math.floor(index / size);
                const col = index % size;
                return (
                  <button
                    key={index}
                    type="button"
                    data-patch-cell={index}
                    className="patches-cell"
                    aria-label={`Row ${row + 1}, column ${col + 1}`}
                    onPointerDown={(event) => onCellPointerDown(event, index)}
                    onClick={(event) => {
                      if (event.detail === 0) tap(index);
                    }}
                  />
                );
              })}
            </div>

            <div className="patches-layer" aria-hidden="true">
              {patches.map((patch, index) => {
                const clueIndex = puzzle.clues.findIndex(
                  (clue) => clue.x === patch.clueX && clue.y === patch.clueY,
                );
                return (
                  <div
                    key={`${patch.x}-${patch.y}-${patch.w}-${patch.h}-${index}`}
                    className="patch"
                    style={{
                      left: `${(patch.x / size) * 100}%`,
                      top: `${(patch.y / size) * 100}%`,
                      width: `${(patch.w / size) * 100}%`,
                      height: `${(patch.h / size) * 100}%`,
                      background: PATCH_FILLS[(clueIndex + size) % PATCH_FILLS.length],
                    }}
                  />
                );
              })}
              {preview ? (
                <div
                  className="patch-preview"
                  style={{
                    left: `${(preview.x / size) * 100}%`,
                    top: `${(preview.y / size) * 100}%`,
                    width: `${(preview.w / size) * 100}%`,
                    height: `${(preview.h / size) * 100}%`,
                  }}
                />
              ) : null}
            </div>

            <div
              className="patches-numbers"
              style={{
                gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
              }}
              aria-hidden="true"
            >
              {puzzle.clues.map((clue) => {
                const used = usedClues.has(`${clue.x},${clue.y}`);
                return (
                  <span
                    key={`${clue.x}-${clue.y}`}
                    className={`patch-number ${used ? "is-used" : ""}`}
                    style={{
                      gridColumn: clue.x + 1,
                      gridRow: clue.y + 1,
                    }}
                  >
                    {clue.area}
                  </span>
                );
              })}
            </div>
          </div>
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
              A fresh Patches board every day. Fewer clues means bigger patches.
            </p>
          )}
        </div>
      </section>

      <aside className="game-side">
        <section className="panel">
          <div className="panel-head">
            <h2>Coverage</h2>
            <span className="panel-value">
              {covered}/{total}
            </span>
          </div>
          <div
            className="progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={covered}
            aria-label="Cells covered"
          >
            <span style={{ width: `${(covered / total) * 100}%` }} />
          </div>
          <dl className="stat-list">
            <div>
              <dt>Time</dt>
              <dd>{formatTime(seconds)}</dd>
            </div>
            <div>
              <dt>Patches</dt>
              <dd>
                {patches.length}/{puzzle.clues.length}
              </dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>
                {size}×{size}
              </dd>
            </div>
            <div>
              <dt>Clues</dt>
              <dd>{puzzle.clues.length}</dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <h2>Rules</h2>
          <ul className="rule-list">
            <li>Split the grid into rectangles and squares.</li>
            <li>Each patch contains exactly one clue.</li>
            <li>The clue number is the patch area.</li>
            <li>No overlaps and no uncovered cells.</li>
            <li>Tap a patch to remove it.</li>
          </ul>
        </section>
      </aside>

      {solved && !winDismissed ? (
        <Modal
          title="Board covered"
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
          <p className="modal-lede">
            Every cell covered, every clue matched, nothing overlapping.
          </p>
          <p className="modal-note">
            {size}×{size} · {patches.length} patches · {DIFFICULTY_LABELS[activeDifficulty]}
          </p>
        </Modal>
      ) : null}
    </GameShell>
  );
}
