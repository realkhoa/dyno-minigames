import { useEffect } from "react";
import { CrossclimbGame } from "./games/crossclimb/CrossclimbGame";
import { PatchesGame } from "./games/patches/PatchesGame";
import { PinpointGame } from "./games/pinpoint/PinpointGame";
import { QueensGame } from "./games/queens/QueensGame";
import { SudokuGame } from "./games/sudoku/SudokuGame";
import { TangoGame } from "./games/tango/TangoGame";
import { WendGame } from "./games/wend/WendGame";
import { ZipGame } from "./games/zip/ZipGame";
import { useHashRoute } from "./lib/router";
import { Dashboard } from "./pages/Dashboard";

const GAME_TITLES: Record<string, string> = {
  tango: "Tango",
  queens: "Queens",
  zip: "Zip",
  sudoku: "Mini Sudoku",
  patches: "Patches",
  crossclimb: "Crossclimb",
  pinpoint: "Pinpoint",
  wend: "Wend",
};

function renderPage(route: string) {
  switch (route) {
    case "tango":
      return <TangoGame />;
    case "queens":
      return <QueensGame />;
    case "zip":
      return <ZipGame />;
    case "sudoku":
      return <SudokuGame />;
    case "patches":
      return <PatchesGame />;
    case "crossclimb":
      return <CrossclimbGame />;
    case "pinpoint":
      return <PinpointGame />;
    case "wend":
      return <WendGame />;
    default:
      return <Dashboard />;
  }
}

export default function App() {
  const route = useHashRoute();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route]);

  const title = GAME_TITLES[route];

  return (
    <div className="vs-shell">
      <div className="vs-titlebar">
        <span className="vs-brand">
          <span className="vs-brand-mark" aria-hidden="true" />
          <span>Dyno MiniGames</span>
        </span>
        <span className="vs-title-meta">
          {title ? `${title} — Puzzle Workspace` : "Puzzle Workspace"}
        </span>
      </div>

      <nav className="vs-tabs" aria-label="Open documents">
        <a className={`vs-tab ${title ? "" : "is-active"}`} href="#/">
          Start Page
        </a>
        {title ? (
          <span className="vs-tab is-active">
            {title}
            <a className="vs-tab-close" href="#/" aria-label={`Close ${title}`}>
              ×
            </a>
          </span>
        ) : null}
      </nav>

      <main className="vs-content">{renderPage(route)}</main>

      <div className="vs-statusbar">
        <span>{title ? `${title} — progress saved locally` : "Ready"}</span>
        <span className="vs-status-right">
          8 puzzles
          <span className="vs-status-sep">|</span>
          <a href="https://github.com/realkhoa/dyno-minigames">source</a>
        </span>
      </div>
    </div>
  );
}
