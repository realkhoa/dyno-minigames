const PREFIX = "dyno:minigames:v1";

export interface GameProgress {
  cells: number[];
  seconds: number;
  solved: boolean;
}

export type TangoProgress = GameProgress;

function safeStorage(): Storage | null {
  try {
    const probe = `${PREFIX}:probe`;
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

const store = safeStorage();

export function loadGameProgress(game: string, puzzleId: string): GameProgress | null {
  if (!store) return null;
  try {
    const raw = store.getItem(`${PREFIX}:${game}:${puzzleId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GameProgress>;
    if (!Array.isArray(parsed.cells) || typeof parsed.seconds !== "number") {
      return null;
    }
    return {
      cells: parsed.cells.map((n) => (n === 1 || n === 2 ? n : 0)),
      seconds: Math.max(0, Math.floor(parsed.seconds)),
      solved: parsed.solved === true,
    };
  } catch {
    return null;
  }
}

export function saveGameProgress(
  game: string,
  puzzleId: string,
  progress: GameProgress,
): void {
  if (!store) return;
  try {
    store.setItem(`${PREFIX}:${game}:${puzzleId}`, JSON.stringify(progress));
  } catch {
    // Quota or privacy mode: progress just won't persist.
  }
}

export function clearGameProgress(game: string, puzzleId: string): void {
  if (!store) return;
  try {
    store.removeItem(`${PREFIX}:${game}:${puzzleId}`);
  } catch {
    // ignore
  }
}

/* Generic JSON slots for games whose state is not a 0/1/2 cell grid. */

export function loadGameJson<T>(game: string, puzzleId: string): T | null {
  if (!store) return null;
  try {
    const raw = store.getItem(`${PREFIX}:${game}:${puzzleId}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveGameJson<T>(game: string, puzzleId: string, value: T): void {
  if (!store) return;
  try {
    store.setItem(`${PREFIX}:${game}:${puzzleId}`, JSON.stringify(value));
  } catch {
    // ignore
  }
}

/* Tango-specific aliases kept for the existing game and dashboard. */

export function loadTangoProgress(puzzleId: string): TangoProgress | null {
  return loadGameProgress("tango", puzzleId);
}

export function saveTangoProgress(puzzleId: string, progress: TangoProgress): void {
  saveGameProgress("tango", puzzleId, progress);
}

export function clearTangoProgress(puzzleId: string): void {
  clearGameProgress("tango", puzzleId);
}

export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
