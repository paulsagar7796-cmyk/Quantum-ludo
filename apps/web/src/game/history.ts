import type { Color, GameState, ObservationMode } from "@qludo/engine";

/** One finished game, as remembered on this device. */
export interface GameRecord {
  id: string;
  endedAt: number;
  /** How this device took part. */
  mode: "local" | "host" | "guest" | "online";
  observationMode: ObservationMode;
  rounds: number;
  /** "finish" or the mercy cap. */
  reason: "finish" | "roundCap";
  players: {
    seat: number;
    name: string;
    color: Color;
    /** Played on this device. */
    mine: boolean;
    bot: boolean;
    place: number;
    total: number;
  }[];
}

export interface Stats {
  games: number;
  /** Games where a player on this device placed first. */
  wins: number;
  winRate: number;
  /** Average total of this device's best-placed player. */
  averageScore: number;
  bestScore: number;
}

const KEY = "qludo.history.v1";
const MAX = 50;

export function recordFromState(
  state: GameState,
  opts: {
    mode: GameRecord["mode"];
    name: (seat: number) => string;
    mine: ReadonlySet<number>;
    bots: ReadonlySet<number>;
  },
): GameRecord | null {
  const r = state.result;
  if (!r) return null;
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    endedAt: Date.now(),
    mode: opts.mode,
    observationMode: state.config.observationMode,
    rounds: r.rounds,
    reason: r.reason,
    players: r.ranking.map((seat, place) => ({
      seat,
      name: opts.name(seat),
      color: state.players[seat]!.color,
      mine: opts.mine.has(seat),
      bot: opts.bots.has(seat),
      place: place + 1,
      total: r.scores[seat]!.total,
    })),
  };
}

export function statsOf(history: GameRecord[]): Stats {
  const mine = history
    .map((g) => g.players.filter((p) => p.mine).sort((a, b) => a.place - b.place)[0])
    .filter((p): p is GameRecord["players"][number] => !!p);
  const wins = mine.filter((p) => p.place === 1).length;
  return {
    games: mine.length,
    wins,
    winRate: mine.length ? wins / mine.length : 0,
    averageScore: mine.length ? mine.reduce((s, p) => s + p.total, 0) / mine.length : 0,
    bestScore: mine.reduce((m, p) => Math.max(m, p.total), 0),
  };
}

export function loadHistory(): GameRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as GameRecord[]) : [];
  } catch {
    return [];
  }
}

export function addToHistory(record: GameRecord): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([record, ...loadHistory()].slice(0, MAX)));
  } catch {
    // Storage full or unavailable: history is a nice-to-have.
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do.
  }
}
