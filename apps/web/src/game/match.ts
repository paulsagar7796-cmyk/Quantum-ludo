import { PERSONALITIES, type PersonalityId } from "@qludo/bots";
import { SEAT_COLORS, type ObservationMode, type PlayerCount } from "@qludo/engine";
import { COLOR_NAME } from "./labels";

export interface SeatConfig {
  kind: "human" | "bot";
  bot: PersonalityId;
  name: string;
}

/** "instant" is for automated tests only; the lobby offers the other three. */
export type BotSpeed = "fast" | "normal" | "slow" | "instant";

export interface MatchConfig {
  playerCount: PlayerCount;
  observationMode: ObservationMode;
  /** One entry per possible seat (always 4); only the first `playerCount` are used. */
  seats: SeatConfig[];
  botSpeed: BotSpeed;
}

const DEFAULT_BOTS: PersonalityId[] = ["hunter", "racer", "gambler", "banker"];

export function defaultMatch(): MatchConfig {
  return {
    playerCount: 4,
    observationMode: "coin",
    botSpeed: "normal",
    seats: DEFAULT_BOTS.map((bot, i) => ({ kind: i === 0 ? "human" : "bot", bot, name: i === 0 ? "You" : "" })),
  };
}

export function activeSeats(m: MatchConfig): SeatConfig[] {
  return m.seats.slice(0, m.playerCount);
}

/** Display name for a seat: the typed name, or the bot's name, or the colour. */
export function seatName(m: MatchConfig, seat: number): string {
  const s = m.seats[seat]!;
  if (s.name.trim()) return s.name.trim();
  if (s.kind === "bot") return PERSONALITIES[s.bot].name;
  return COLOR_NAME[SEAT_COLORS[m.playerCount][seat]!];
}

const STORAGE_KEY = "qludo.match.v1";

export function loadMatch(): MatchConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const m = JSON.parse(raw) as MatchConfig;
      if (m.seats?.length === 4 && [2, 3, 4].includes(m.playerCount)) return m;
    }
  } catch {
    // Storage can be unavailable (private mode); fall back to defaults.
  }
  return defaultMatch();
}

export function saveMatch(m: MatchConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
  } catch {
    // Not critical.
  }
}
