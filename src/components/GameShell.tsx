import { useState, type ReactNode } from "react";
import { ArrowLeftIcon } from "./icons";
import { Modal } from "./Modal";

interface GameShellProps {
  title: string;
  subtitle: ReactNode;
  helpTitle: string;
  help: ReactNode;
  children: ReactNode;
  footerNote?: string;
}

/**
 * Common chrome for every game: back link, centred title, help dialog,
 * two-column layout slot and footer.
 */
export function GameShell({
  title,
  subtitle,
  helpTitle,
  help,
  children,
  footerNote = "Progress is saved in this browser.",
}: GameShellProps) {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="app-shell game-shell">
      <header className="game-header">
        <a className="back-link" href="#/">
          <ArrowLeftIcon className="back-icon" />
          All games
        </a>
        <div className="game-heading">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          onClick={() => setHelpOpen(true)}
        >
          How to play
        </button>
      </header>

      <div className="game-layout">{children}</div>

      <footer className="site-footer">
        <span>Dyno MiniGames</span>
        <span className="footer-sep">·</span>
        <span>{footerNote}</span>
      </footer>

      {helpOpen ? (
        <Modal title={helpTitle} onClose={() => setHelpOpen(false)}>
          {help}
          <div className="modal-actions modal-actions-end">
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => setHelpOpen(false)}
            >
              Got it
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
