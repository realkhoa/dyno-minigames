import type { ReactNode } from "react";
import {
  ArrowLeftIcon,
  CrossclimbMark,
  PatchesMark,
  PinpointMark,
  QueensMark,
  SudokuMark,
  TangoMark,
  WendMark,
  ZipMark,
} from "../components/icons";
import { todayKey } from "../games/tango/engine";
import { loadGameJson, loadGameProgress } from "../lib/storage";

interface GameEntry {
  id: string;
  name: string;
  blurb: string;
  meta: string;
  status: "live" | "soon";
  href?: string;
  mark: ReactNode;
}

const GAMES: GameEntry[] = [
  {
    id: "tango",
    name: "Tango",
    blurb: "Balance suns and moons. Fill the grid without tripling up a line.",
    meta: "6×6 · 4 difficulties",
    status: "live",
    href: "#/tango",
    mark: <TangoMark />,
  },
  {
    id: "queens",
    name: "Queens",
    blurb: "One queen per row, column and colour region. No two may touch.",
    meta: "4 board sizes",
    status: "live",
    href: "#/queens",
    mark: <QueensMark />,
  },
  {
    id: "zip",
    name: "Zip",
    blurb: "Draw one path through every cell, hitting the numbers in order.",
    meta: "4 sizes · checkpoints",
    status: "live",
    href: "#/zip",
    mark: <ZipMark />,
  },
  {
    id: "sudoku",
    name: "Mini Sudoku",
    blurb: "A 6×6 sudoku: every row, column and box gets 1 to 6 exactly once.",
    meta: "4 clue counts",
    status: "live",
    href: "#/sudoku",
    mark: <SudokuMark />,
  },
  {
    id: "crossclimb",
    name: "Crossclimb",
    blurb: "Climb a ladder of words, one letter at a time, guided by clues.",
    meta: "Word ladder",
    status: "soon",
    mark: <CrossclimbMark />,
  },
  {
    id: "pinpoint",
    name: "Pinpoint",
    blurb: "Five clues, one hidden category. Name it before the reveal.",
    meta: "Word game",
    status: "soon",
    mark: <PinpointMark />,
  },
  {
    id: "patches",
    name: "Patches",
    blurb: "Split the grid into rectangles whose areas match the numbers.",
    meta: "4 board sizes",
    status: "live",
    href: "#/patches",
    mark: <PatchesMark />,
  },
  {
    id: "wend",
    name: "Wend",
    blurb: "Trace winding words through every letter on the board.",
    meta: "Word paths",
    status: "soon",
    mark: <WendMark />,
  },
];

export function Dashboard() {
  const solvedTango = loadGameProgress("tango", `deadly:${todayKey()}`)?.solved === true;
  const solvedQueens = loadGameProgress("queens", `hard:${todayKey()}`)?.solved === true;
  const solvedZip =
    loadGameJson<{ solved?: boolean }>("zip", `medium:${todayKey()}`)?.solved === true;
  const solvedSudoku =
    loadGameJson<{ solved?: boolean }>("sudoku", `medium:${todayKey()}`)?.solved === true;
  const solvedPatches =
    loadGameJson<{ solved?: boolean }>("patches", `medium:${todayKey()}`)?.solved === true;
  const solvedToday: Record<string, boolean> = {
    tango: solvedTango,
    queens: solvedQueens,
    zip: solvedZip,
    sudoku: solvedSudoku,
    patches: solvedPatches,
  };
  const liveCount = GAMES.filter((game) => game.status === "live").length;
  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#/" aria-label="Dyno MiniGames home">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="brand-text">
            Dyno<span>MiniGames</span>
          </span>
        </a>
        <div className="header-badges">
          <span className="pill-chip">{dateLabel}</span>
        </div>
      </header>

      <main id="main">
        <section className="hero">
          <h1 id="games-title">Games</h1>
          <p className="hero-lede">
            Daily logic puzzles in the LinkedIn style. Tango and Queens are live; the rest of the
            shelf is on the way. Everything runs in the browser — no account, no backend.
          </p>
          <div className="hero-stats">
            <span className="pill-chip">
              <span className="live-dot" aria-hidden="true" />
              {liveCount} playable
            </span>
            <span className="pill-chip">{GAMES.length - liveCount} planned</span>
            <span className="pill-chip">Progress saved locally</span>
          </div>
        </section>

        <section className="games-section" aria-labelledby="games-title">
          <div className="game-grid">
            {GAMES.map((game) =>
              game.status === "live" ? (
                <a
                  className="game-card is-live"
                  data-game={game.id}
                  href={game.href}
                  key={game.id}
                >
                  <span className="game-icon" aria-hidden="true">
                    {game.mark}
                  </span>
                  <div className="game-body">
                    <div className="game-title-row">
                      <h3 className="game-name">{game.name}</h3>
                      <span className="tag live">
                        {solvedToday[game.id] ? "Solved today" : "Play"}
                      </span>
                    </div>
                    <p className="game-blurb">{game.blurb}</p>
                  </div>
                  <div className="game-foot">
                    <span>{game.meta}</span>
                    <span className="arrow" aria-hidden="true">
                      →
                    </span>
                  </div>
                </a>
              ) : (
                <div
                  className="game-card is-soon"
                  data-game={game.id}
                  key={game.id}
                  aria-disabled="true"
                >
                  <span className="game-icon" aria-hidden="true">
                    {game.mark}
                  </span>
                  <div className="game-body">
                    <div className="game-title-row">
                      <h3 className="game-name">{game.name}</h3>
                      <span className="tag soon">Soon</span>
                    </div>
                    <p className="game-blurb">{game.blurb}</p>
                  </div>
                  <div className="game-foot">
                    <span>{game.meta}</span>
                    <span className="arrow is-muted" aria-hidden="true">
                      <ArrowLeftIcon className="flip" />
                    </span>
                  </div>
                </div>
              ),
            )}
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <span>Dyno MiniGames</span>
        <span className="footer-sep">·</span>
        <span>Built for GitHub Pages</span>
        <span className="footer-sep">·</span>
        <span>No accounts, no tracking, no backend.</span>
      </footer>
    </div>
  );
}
