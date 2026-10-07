import { describe, expect, it } from "vitest";
import { SeededRng, applyAction, createGame, isLegal, legalActions, type GameState } from "@qludo/engine";
import { PERSONALITY_IDS, createBot, type Bot } from "../src";

function play(bots: Bot[], seed: number, mode: "coin" | "choice"): GameState {
  const rng = new SeededRng(seed);
  let s = createGame({ playerCount: bots.length as 2 | 3 | 4, observationMode: mode });
  while (s.phase !== "over") {
    const a = bots[s.current]!.choose(s);
    expect(isLegal(s, a)).toBe(true);
    s = applyAction(s, a, rng).state;
  }
  return s;
}

describe("bots", () => {
  it("every personality plays full games using only legal actions", () => {
    const bots = PERSONALITY_IDS.map((id) => createBot(id));
    for (const mode of ["coin", "choice"] as const) {
      expect(play(bots, 3, mode).result).not.toBeNull();
    }
  }, 60_000);

  it("is deterministic", () => {
    const run = () =>
      play(
        PERSONALITY_IDS.map((id) => createBot(id)),
        11,
        "coin",
      );
    expect(run()).toEqual(run());
  }, 60_000);

  it("the Racer never uses Split, Link or Force", () => {
    const racer = createBot("racer");
    const s = createGame({ playerCount: 2 });
    s.players[0]!.tokens[0] = { pos: 10, split: null, drifting: false };
    s.players[0]!.tokens[1] = { pos: 20, split: null, drifting: false };
    s.players[0]!.q = 4;
    s.phase = "act";
    s.roll = 2;
    expect(legalActions(s).some((a) => a.type === "superpose")).toBe(true);
    expect(["move", "ghost"]).toContain(racer.choose(s).type);
  });
});
