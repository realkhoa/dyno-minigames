import { useEffect, useMemo, useRef, useState } from "react";
import { GameShell } from "../../components/GameShell";
import { Modal } from "../../components/Modal";
import { clearGameProgress, formatTime, loadGameJson, saveGameJson } from "../../lib/storage";
import { categoryForSeed, matchesCategory, todayKey } from "./engine";

type Mode = "daily" | "practice";

interface SavedPinpoint {
  revealed: number;
  attempts: number;
  solved: boolean;
  seconds: number;
}

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 9);
}

export function PinpointGame() {
  const [mode, setMode] = useState<Mode>("daily");
  const [practiceSeed, setPracticeSeed] = useState(randomSeed);

  const dailySeed = useMemo(() => todayKey(), []);
  const seed = mode === "daily" ? dailySeed : practiceSeed;
  const selected = useMemo(() => categoryForSeed(seed, mode), [seed, mode]);
  const category = selected.category;

  const [revealed, setRevealed] = useState(1);
  const [guess, setGuess] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [solved, setSolved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  const [winDismissed, setWinDismissed] = useState(false);
  const composing = useRef(false);

  useEffect(() => {
    const saved = loadGameJson<SavedPinpoint>("pinpoint", selected.id);
    const savedRevealed =
      typeof saved?.revealed === "number"
        ? Math.min(5, Math.max(1, Math.floor(saved.revealed)))
        : 1;
    setRevealed(savedRevealed);
    setAttempts(typeof saved?.attempts === "number" ? Math.max(0, saved.attempts) : 0);
    setSolved(saved?.solved === true);
    setSeconds(typeof saved?.seconds === "number" ? Math.max(0, saved.seconds) : 0);
    setWinDismissed(saved?.solved === true);
    setGuess("");
    setMessage(null);
    setHydratedId(selected.id);
  }, [selected]);

  useEffect(() => {
    if (solved) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [solved, selected.id]);

  useEffect(() => {
    if (hydratedId !== selected.id) return;
    saveGameJson<SavedPinpoint>("pinpoint", selected.id, {
      revealed,
      attempts,
      solved,
      seconds,
    });
  }, [revealed, attempts, solved, seconds, selected.id, hydratedId]);

  const submit = () => {
    if (solved) return;
    const value = guess.trim();
    if (!value) return;
    setAttempts((count) => count + 1);
    if (matchesCategory(category, value)) {
      setSolved(true);
      setMessage(null);
      setGuess("");
      return;
    }
    setMessage("Not quite — try a broader or narrower category.");
    setGuess("");
  };

  const restart = () => {
    setRevealed(1);
    setAttempts(0);
    setSolved(false);
    setMessage(null);
    setGuess("");
    setSeconds(0);
    setWinDismissed(false);
    clearGameProgress("pinpoint", selected.id);
  };

  const newPracticePuzzle = () => {
    setPracticeSeed(randomSeed());
    setWinDismissed(false);
  };

  const dateLabel = new Date(`${dailySeed}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  const status = solved
    ? `Solved with ${revealed} clue${revealed === 1 ? "" : "s"} revealed.`
    : (message ??
      `${revealed} of 5 clues revealed · ${attempts} guess${attempts === 1 ? "" : "es"} so far.`);

  return (
    <GameShell
      title="Pinpoint"
      subtitle={
        <>
          {mode === "daily" ? `Daily puzzle · ${dateLabel}` : "Practice"}
          <span className="dot-separator">·</span>
          {revealed} of 5 clues
        </>
      }
      helpTitle="How to play Pinpoint"
      help={
        <>
          <p className="modal-lede">
            Five clues share one hidden category. Name the category.
          </p>
          <ul className="modal-rules">
            <li>Clues appear one at a time — start with the first.</li>
            <li>Every clue belongs to the same category.</li>
            <li>Type your answer and submit, or ask for the next clue.</li>
            <li>Guesses are free; fewer clues means a better result.</li>
            <li>Case, punctuation and plurals do not matter.</li>
          </ul>
          <p className="modal-note">
            A correct answer is matched against the category and its common aliases.
          </p>
        </>
      }
    >
      <section className="board-panel" aria-label="Pinpoint clues">
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

        <div className="pinpoint">
          <p className="pinpoint-prompt">What do these have in common?</p>

          <ol className="pinpoint-clues" aria-live="polite">
            {category.clues.slice(0, revealed).map((clue, index) => (
              <li key={clue}>
                <span className="pinpoint-clue-num" aria-hidden="true">
                  {index + 1}
                </span>
                <span>{clue}</span>
              </li>
            ))}
          </ol>

          <div className="pinpoint-controls">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setRevealed((count) => Math.min(5, count + 1))}
              disabled={revealed >= 5 || solved}
            >
              {revealed >= 5 ? "All clues revealed" : `Reveal clue ${revealed + 1}`}
            </button>
          </div>

          <div className="pinpoint-form">
            <input
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
              onCompositionStart={() => {
                composing.current = true;
              }}
              onCompositionEnd={() => {
                composing.current = false;
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                // Enter also confirms a Vietnamese/IME composition; do not
                // submit the half-composed guess in that case.
                if (event.nativeEvent.isComposing || composing.current) return;
                event.preventDefault();
                submit();
              }}
              placeholder="Name the category"
              aria-label="Your answer"
              autoComplete="off"
              spellCheck={false}
              disabled={solved}
            />
            <button
              className="btn btn-primary btn-sm"
              type="button"
              onClick={submit}
              disabled={solved || !guess.trim()}
            >
              Guess
            </button>
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
              New category
            </button>
          ) : (
            <p className="daily-note">
              A new category every day. Practice mode serves the rest of the set.
            </p>
          )}
        </div>
      </section>

      <aside className="game-side">
        <section className="panel">
          <div className="panel-head">
            <h2>Clues</h2>
            <span className="panel-value">{revealed}/5</span>
          </div>
          <div
            className="progress"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={5}
            aria-valuenow={revealed}
            aria-label="Clues revealed"
          >
            <span style={{ width: `${(revealed / 5) * 100}%` }} />
          </div>
          <dl className="stat-list">
            <div>
              <dt>Time</dt>
              <dd>{formatTime(seconds)}</dd>
            </div>
            <div>
              <dt>Guesses</dt>
              <dd>{attempts}</dd>
            </div>
            <div>
              <dt>Clues left</dt>
              <dd>{5 - revealed}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{solved ? "solved" : "open"}</dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <h2>Rules</h2>
          <ul className="rule-list">
            <li>All five clues belong to one category.</li>
            <li>Reveal clues only when you need them.</li>
            <li>Type the category and submit.</li>
            <li>Plurals and punctuation are ignored.</li>
            <li>Fewer clues used is a better solve.</li>
          </ul>
        </section>
      </aside>

      {solved && !winDismissed ? (
        <Modal
          title="Category found"
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
                {mode === "practice" ? "Next category" : "Play again"}
              </button>
              <a className="btn btn-ghost" href="#/">
                Dashboard
              </a>
            </div>
          }
        >
          <p className="win-answer">{category.answer}</p>
          <p className="win-time">{formatTime(seconds)}</p>
          <p className="modal-lede">
            Found with {revealed} clue{revealed === 1 ? "" : "s"} and {attempts} guess
            {attempts === 1 ? "" : "es"}.
          </p>
          <p className="modal-note">{category.clues.join(" · ")}</p>
        </Modal>
      ) : null}
    </GameShell>
  );
}
