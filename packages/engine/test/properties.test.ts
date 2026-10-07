import { describe, expect, it } from "vitest";
import {
  HOME_POS,
  SeededRng,
  YARD,
  absSquare,
  applyAction,
  createGame,
  isOnTrack,
  isSafe,
  legalActions,
  type Action,
  type GameState,
  type ObservationMode,
  type PlayerCount,
} from "../src";

function checkInvariants(s: GameState, ghostUsed: boolean): void {
  const presence = new Map<number, Set<number>>();
  const mark = (sq: number | null, seat: number) => {
    if (sq === null || isSafe(sq)) return;
    if (!presence.has(sq)) presence.set(sq, new Set());
    presence.get(sq)!.add(seat);
  };

  for (const p of s.players) {
    expect(p.tokens).toHaveLength(4);
    expect(p.q).toBeGreaterThanOrEqual(0);
    expect(p.q).toBeLessThanOrEqual(s.config.rules.maxQ);
    expect(p.tokens.filter((t) => t.split).length).toBeLessThanOrEqual(1);
    for (const t of p.tokens) {
      expect(t.pos).toBeGreaterThanOrEqual(YARD);
      expect(t.pos).toBeLessThanOrEqual(HOME_POS);
      if (t.drifting) {
        expect(t.split).toBeNull();
        expect(isOnTrack(t.pos)).toBe(true);
      }
      if (t.split) {
        expect(isOnTrack(t.pos)).toBe(true);
        for (const m of t.split) {
          expect(m).toBeGreaterThan(t.pos);
          expect(m).toBeLessThanOrEqual(HOME_POS);
          mark(absSquare(p.color, m), p.seat);
        }
      } else {
        mark(absSquare(p.color, t.pos), p.seat);
      }
    }
    if (p.link) {
      for (const i of p.link) {
        const t = p.tokens[i]!;
        expect(t.split).toBeNull();
        expect(isOnTrack(t.pos)).toBe(true);
      }
    }
    expect(p.finished).toBe(p.tokens.every((t) => t.pos === HOME_POS && !t.split));
  }
  // A drift ends at the start of its owner's turn.
  if (s.phase === "upkeep" && !s.bonus) expect(s.players[s.current]!.tokens.some((t) => t.drifting)).toBe(false);
  // Without Ghost, no two colours ever share a normal square, counting markers.
  if (!ghostUsed) for (const seats of presence.values()) expect(seats.size).toBe(1);
}

function playRandom(seed: number, playerCount: PlayerCount, mode: ObservationMode) {
  const engineRng = new SeededRng(seed);
  const pickRng = new SeededRng(seed ^ 0x9e3779b9);
  let s = createGame({ playerCount, observationMode: mode });
  const actions: Action[] = [];
  let steps = 0;
  let ghostUsed = false;
  while (s.phase !== "over") {
    const legal = legalActions(s);
    expect(legal.length).toBeGreaterThan(0);
    const a = legal[Math.floor(pickRng.next() * legal.length)]!;
    actions.push(a);
    const res = applyAction(s, a, engineRng);
    s = res.state;
    ghostUsed ||= res.events.some((e) => e.type === "qSpent" && e.mechanic === "ghost");
    checkInvariants(s, ghostUsed);
    if (++steps > 20000) throw new Error("game did not terminate");
  }
  return { final: s, actions };
}

describe("random legal play", () => {
  const counts: PlayerCount[] = [2, 3, 4];
  const modes: ObservationMode[] = ["coin", "choice"];

  it("keeps every invariant and always terminates", () => {
    for (let seed = 1; seed <= 150; seed++) {
      const { final } = playRandom(seed, counts[seed % 3]!, modes[seed % 2]!);
      expect(final.result).not.toBeNull();
      expect(final.result!.ranking).toHaveLength(final.players.length);
    }
  }, 60_000);

  it("replays identically from (seed, actions)", () => {
    const { final, actions } = playRandom(42, 4, "coin");
    const rng = new SeededRng(42);
    let s = createGame({ playerCount: 4, observationMode: "coin" });
    for (const a of actions) s = applyAction(s, a, rng).state;
    expect(s).toEqual(final);
  });

  it("survives a JSON round trip", () => {
    const { final } = playRandom(7, 3, "choice");
    expect(JSON.parse(JSON.stringify(final))).toEqual(final);
  });
});
