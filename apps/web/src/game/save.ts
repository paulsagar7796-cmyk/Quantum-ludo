import type { GameState } from "@qludo/engine";
import type { LogLine } from "./format";
import type { MatchConfig } from "./match";

/** A game in progress, saved after every action so a refresh or closed tab never loses it. */
export interface SavedGame {
  v: 1;
  match: MatchConfig;
  state: GameState;
  /** RNG position, so the resumed game continues the same random sequence. */
  rng: number;
  log: LogLine[];
  lastRoll: { seat: number; value: number; n: number } | null;
  savedAt: number;
}

const KEY = "qludo.save.v1";
const MAX_SAVED_LOG = 60;

function looksValid(x: unknown): x is SavedGame {
  const s = x as SavedGame;
  return (
    !!s &&
    s.v === 1 &&
    typeof s.rng === "number" &&
    Array.isArray(s.state?.players) &&
    s.state.phase !== "over" &&
    Array.isArray(s.match?.seats)
  );
}

export function loadSave(): SavedGame | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return looksValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeSave(game: Omit<SavedGame, "v" | "savedAt">): void {
  try {
    const save: SavedGame = { ...game, v: 1, log: game.log.slice(0, MAX_SAVED_LOG), savedAt: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Storage full or unavailable: the game still works, it just can't be resumed.
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do.
  }
}
