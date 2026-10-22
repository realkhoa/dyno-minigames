import type { ReactNode } from "react";
import { ArrowLeftIcon, CrossclimbMark, PinpointMark, QueensMark, TangoMark } from "../components/icons";
import { todayKey } from "../games/tango/engine";
import { loadTangoProgress } from "../lib/storage";

interface GameEntry {
  id: string;
  name: string;
  blurb: string;
  meta: string;
  status: "live" | "soon";
  mark: ReactNode;
}

const GAMES: GameEntry[] = [
  {
    id: "tango",
    name: "Tango",
    blurb: "Balance suns and moons. Fill the grid without tripling up a line.",
    meta: "6×6 · 4 difficulties",
    status: "live",
    mark: <TangoMark />,
  },
  {
    id: "queens",
    name: "Queens",
    blurb: "One crown per row, column and colour region. No two may touch.",
    meta: "Grid logic",
    status: "soon",
    mark: <QueensMark />,
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
    id: "crossclimb",
    name: "Crossclimb",
    blurb: "Climb a word ladder from the first clue to the last rung.",
    meta: "Word ladder",
    status: "soon",
    mark: <CrossclimbMark />,
  },
];

export function Dashboard() {
  const solvedToday = loadTangoProgress(`deadly:${todayKey()}`)?.solved === true;
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
          <span className="pill-chip is-accent">v0.1 MVP</span>
        </div>
      </header>

      <main id="main">
        <section className="hero">
          <p className="eyebrow">Daily mini games</p>
          <h1>
            Small puzzles.
            <br />
            <em>One dashboard.</em>
          </h1>
          <p className="hero-lede">
            A growing shelf of quick logic games. Today there is Tango — a 6×6 balance of suns and
            moons with locked clues and linked cells. More games are on the way.
          </p>
          <div className="hero-stats">
            <span className="pill-chip">
              <span className="live-dot" aria-hidden="true" />1 playable
            </span>
            <span className="pill-chip">3 in the works</span>
            <span className="pill-chip">No sign-up · local save</span>
          </div>
        </section>

        <section className="games-section" aria-labelledby="games-title">
          <div className="section-head">
            <h2 id="games-title">Games</h2>
            <span className="section-meta">Pick one and play</span>
          </div>
          <div className="game-grid">
            {GAMES.map((game) =>
              game.status === "live" ? (
                <a
                  className="game-card is-live"
                  data-game={game.id}
                  href="#/tango"
                  key={game.id}
                >
                  <span className="game-icon" aria-hidden="true">
                    {game.mark}
                  </span>
                  <div className="game-body">
                    <div className="game-title-row">
                      <h3 className="game-name">{game.name}</h3>
                      <span className="tag live">
                        {solvedToday ? "Solved today" : "Play"}
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
