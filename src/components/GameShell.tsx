import { useState, type ReactNode } from "react";
import { Modal } from "./Modal";

interface GameShellProps {
  title: string;
  subtitle: ReactNode;
  helpTitle: string;
  help: ReactNode;
  children: ReactNode;
}

/**
 * Document area for a game: a toolbar with the title and help button, then the
 * board + tool-window columns. Window chrome lives in App.
 */
export function GameShell({ title, subtitle, helpTitle, help, children }: GameShellProps) {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="game-shell">
      <header className="game-toolbar">
        <div className="game-heading">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <button className="btn" type="button" onClick={() => setHelpOpen(true)}>
          How to play
        </button>
      </header>

      <div className="game-layout">{children}</div>

      {helpOpen ? (
        <Modal title={helpTitle} onClose={() => setHelpOpen(false)}>
          {help}
          <div className="modal-actions modal-actions-end">
            <button className="btn btn-primary" type="button" onClick={() => setHelpOpen(false)}>
              Got it
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
