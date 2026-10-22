const PREFIX = "dyno:minigames:v1";

export interface TangoProgress {
  cells: number[];
  seconds: number;
  solved: boolean;
}

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

export function loadTangoProgress(puzzleId: string): TangoProgress | null {
  if (!store) return null;
  try {
    const raw = store.getItem(`${PREFIX}:tango:${puzzleId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TangoProgress>;
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

export function saveTangoProgress(puzzleId: string, progress: TangoProgress): void {
  if (!store) return;
  try {
    store.setItem(`${PREFIX}:tango:${puzzleId}`, JSON.stringify(progress));
  } catch {
    // Quota or privacy mode: progress just won't persist.
  }
}

export function clearTangoProgress(puzzleId: string): void {
  if (!store) return;
  try {
    store.removeItem(`${PREFIX}:tango:${puzzleId}`);
  } catch {
    // ignore
  }
}

export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
