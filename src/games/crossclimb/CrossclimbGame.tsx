import { useEffect, useMemo, useRef, useState } from "react";
import { GameShell } from "../../components/GameShell";
import { Modal } from "../../components/Modal";
import { clearGameProgress, formatTime, loadGameJson, saveGameJson } from "../../lib/storage";
import { isSolved, puzzleForSeed, todayKey } from "./engine";

type Mode = "daily" | "practice";

interface SavedCrossclimb {
  entries: string[];
  seconds: number;
  solved: boolean;
}

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 9);
}

export function CrossclimbGame() {
  const [mode, setMode] = useState<Mode>("daily");
  const [practiceSeed, setPracticeSeed] = useState(randomSeed);

  const dailySeed = useMemo(() => todayKey(), []);
  const seed = mode === "daily" ? dailySeed : practiceSeed;
  const selected = useMemo(() => puzzleForSeed(seed, mode), [seed, mode]);
  const puzzle = selected.puzzle;
  const wordLength = puzzle.words[0].length;

  const [entries, setEntries] = useState<string[]>(["", "", ""]);
  const [seconds, setSeconds] = useState(0);
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  const [winDismissed, setWinDismissed] = useState(false);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  const correct = useMemo(
    () =>
      entries.map(
        (entry, index) => entry.trim().toUpperCase() === puzzle.words[index + 1],
      ),
    [entries, puzzle.words],
  );
  const correctCount = correct.filter(Boolean).length;
  const won = isSolved(entries, puzzle);

  useEffect(() => {
    const saved = loadGameJson<SavedCrossclimb>("crossclimb", selected.id);
    const restored =
      Array.isArray(saved?.entries) && saved.entries.length === 3
        ? saved.entries.map((entry) =>
            String(entry).toUpperCase().replace(/[^A-Z]/g, "").slice(0, wordLength),
          )
        : ["", "", ""];
    setEntries(restored);
    setSeconds(typeof saved?.seconds === "number" ? Math.max(0, saved.seconds) : 0);
    setWinDismissed(saved?.solved === true);
    setHydratedId(selected.id);
  }, [selected, wordLength]);

  useEffect(() => {
    if (won) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [won, selected.id]);

  useEffect(() => {
    if (hydratedId !== selected.id) return;
    saveGameJson<SavedCrossclimb>("crossclimb", selected.id, { entries, seconds, solved: won });
  }, [entries, seconds, won, selected.id, hydratedId]);

  const composing = useRef(false);

  /** Fold Vietnamese/IME text to plain A-Z before storing it. */
  const normalise = (raw: string): string =>
    raw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/gi, "d")
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, wordLength);

  const update = (index: number, value: string) => {
    // While an IME is composing, keep the raw text so the composition is not
    // broken by sanitising every keystroke.
    const next = composing.current ? value : normalise(value);
    setEntries((previous) => {
      const copy = previous.slice();
      copy[index] = next;
      return copy;
    });
  };

  const restart = () => {
    setEntries(["", "", ""]);
    setSeconds(0);
    setWinDismissed(false);
    clearGameProgress("crossclimb", selected.id);
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
    ? "Ladder complete — every rung differs by one letter."
    : `${correctCount} of 3 middle words correct.`;

  return (
    <GameShell
      title="Crossclimb"
      subtitle={
        <>
          {mode === "daily" ? `Daily puzzle · ${dateLabel}` : "Practice"}
          <span className="dot-separator">·</span>
          5 rungs
          <span className="dot-separator">·</span>
          {wordLength}-letter words
        </>
      }
      helpTitle="How to play Crossclimb"
      help={
        <>
          <p className="modal-lede">
            A ladder of five words. Each rung changes exactly one letter from the rung above it.
          </p>
          <ul className="modal-rules">
            <li>The top and bottom words are given.</li>
            <li>Fill the three middle words from their clues.</li>
            <li>Neighbouring words differ by one letter, in the same position.</li>
            <li>Letters never move — only one position changes per step.</li>
            <li>Press Enter to jump to the next empty rung.</li>
          </ul>
          <p className="modal-note">
            Answers are checked exactly, so read each clue literally.
          </p>
        </>
      }
    >
      <section className="board-panel" aria-label="Crossclimb ladder">
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

        <div className="climb">
          {puzzle.words.map((word, row) => {
            const given = row === 0 || row === 4;
            const middleIndex = row - 1;
            const clue = given
              ? puzzle.endClues[row === 0 ? 0 : 1]
              : puzzle.clues[middleIndex];
            const isCorrect = !given && correct[middleIndex];

            return (
              <div
                key={row}
                className={`climb-row ${given ? "is-given" : ""} ${isCorrect ? "is-correct" : ""}`}
              >
                <span className="climb-step" aria-hidden="true">
                  {row + 1}
                </span>
                <div className="climb-main">
                  <p className="climb-clue">{clue}</p>
                  {given ? (
                    <div
                      className="climb-word"
                      aria-label={`Given word: ${word}`}
                    >
                      {word.split("").map((letter, index) => (
                        <span className="climb-tile" key={index}>
                          {letter}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <input
                      ref={(element) => {
                        inputs.current[middleIndex] = element;
                      }}
                      className="climb-input"
                      value={entries[middleIndex]}
                      onChange={(event) => update(middleIndex, event.target.value)}
                      onCompositionStart={() => {
                        composing.current = true;
                      }}
                      onCompositionEnd={(event) => {
                        composing.current = false;
                        update(middleIndex, event.currentTarget.value);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          if (event.nativeEvent.isComposing) return;
                          event.preventDefault();
                          const next = inputs.current[middleIndex + 1];
                          if (next) next.focus();
                          else inputs.current[middleIndex]?.blur();
                        }
                      }}
                      aria-label={`Rung ${row + 1}: ${clue}`}
                      placeholder={"·".repeat(wordLength)}
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                    />
                  )}
                </div>
                <span className="climb-mark" aria-hidden="true">
                  {isCorrect ? "✓" : ""}
                </span>
              </div>
            );
          })}
        </div>

        <div
          className={`board-status ${won ? "is-win" : ""}`}
          role="status"
          aria-live="polite"
        >
          <span className="status-dot" aria-hidden="true" />
          <span>{status}</span>
        </div>

        <div className="board-actions">
          {mode === "practice" ? (
            <button className="btn btn-primary btn-sm" type="button" onClick={newPracticePuzzle}>
              New ladder
            </button>
          ) : (
            <p className="daily-note">
              A fresh ladder every day. Practice mode draws from the same puzzle pool.
            </p>
          )}
        </div>
      </section>

      <aside className="game-side">
        <section className="panel">
          <div className="panel-head">
            <h2>Ladder</h2>
            <span className="panel-value">{correctCount}/3</span>
          </div>
          <div
            className="progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={3}
            aria-valuenow={correctCount}
            aria-label="Middle words solved"
          >
            <span style={{ width: `${(correctCount / 3) * 100}%` }} />
          </div>
          <dl className="stat-list">
            <div>
              <dt>Time</dt>
              <dd>{formatTime(seconds)}</dd>
            </div>
            <div>
              <dt>Rungs</dt>
              <dd>5</dd>
            </div>
            <div>
              <dt>Word length</dt>
              <dd>{wordLength}</dd>
            </div>
            <div>
              <dt>Letters fixed</dt>
              <dd>{wordLength - 1}</dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <h2>Rules</h2>
          <ul className="rule-list">
            <li>The top and bottom words are given.</li>
            <li>Fill the three middle rungs from their clues.</li>
            <li>Each step changes exactly one letter.</li>
            <li>Letters keep their positions.</li>
            <li>Answers are checked exactly.</li>
          </ul>
        </section>
      </aside>

      {won && !winDismissed ? (
        <Modal
          title="Ladder complete"
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
                {mode === "practice" ? "Next ladder" : "Play again"}
              </button>
              <a className="btn btn-ghost" href="#/">
                Dashboard
              </a>
            </div>
          }
        >
          <p className="win-time">{formatTime(seconds)}</p>
          <div className="win-ladder" aria-hidden="true">
            {puzzle.words.map((word) => (
              <span key={word}>{word}</span>
            ))}
          </div>
          <p className="modal-lede">Five words, one letter apart at every step.</p>
        </Modal>
      ) : null}
    </GameShell>
  );
}
