import { describe, expect, it } from "vitest";
import { YARD, finalScores, legalActions } from "../src";
import { HEADS, TAILS, apply, game, place, rel, split, types, withRoll } from "./helpers";

describe("Superposition (Split)", () => {
  it("places markers at r and 7 - r ahead for 1 Q", () => {
    const s = withRoll(place(game(), 0, [10]), 2);
    expect(legalActions(s)).toContainEqual({ type: "superpose", token: 0 });
    const { state, events } = apply(s, { type: "superpose", token: 0 });
    expect(state.players[0]!.tokens[0]!.split).toEqual([12, 15]);
    expect(state.players[0]!.q).toBe(0);
    expect(events).toContainEqual({ type: "superposed", seat: 0, token: 0, markers: [12, 15] });
    expect(state.current).toBe(1);
  });

  it("is not available without Q, from the yard, or from the home column", () => {
    const noQ = withRoll(place(game(), 0, [10]), 2);
    noQ.players[0]!.q = 0;
    expect(types(legalActions(noQ))).not.toContain("superpose");
    expect(types(legalActions(withRoll(game(), 6)))).not.toContain("superpose");
    expect(types(legalActions(withRoll(place(game(), 0, [51]), 2)))).not.toContain("superpose");
  });

  it("allows only one superposed token per player", () => {
    const s = withRoll(split(place(game(), 0, [10]), 0, 1, 20, [22, 25]), 2);
    expect(types(legalActions(s))).not.toContain("superpose");
  });

  it("cannot superpose an entangled token", () => {
    const s = withRoll(place(game(), 0, [10, 20]), 2);
    s.players[0]!.link = [0, 1];
    expect(types(legalActions(s))).not.toContain("superpose");
  });

  it("cannot put a marker on a normal square held by an opponent", () => {
    const s = withRoll(place(place(game(), 0, [10]), 1, [rel("green", 15)]), 2);
    expect(types(legalActions(s))).not.toContain("superpose");
  });

  it("cannot put a marker on a normal square holding an opponent's marker", () => {
    const s = withRoll(split(place(game(), 0, [10]), 1, 0, rel("green", 13), [rel("green", 15), rel("green", 18)]), 2);
    expect(types(legalActions(s))).not.toContain("superpose");
  });

  it("makes the owner collapse or hold at the start of their next turn", () => {
    const s = split(game(), 0, 0, 10, [12, 15]);
    expect(legalActions(s)).toEqual([
      { type: "collapse", marker: 0 },
      { type: "collapse", marker: 1 },
      { type: "hold" },
    ]);
    const { state } = apply(s, { type: "collapse", marker: 1 });
    expect(state.players[0]!.tokens[0]).toEqual({ pos: 15, split: null, drifting: false });
    expect(legalActions(state)).toContainEqual({ type: "roll" });
  });

  it("does not force a collapse on a bonus roll in the same turn", () => {
    const s = split(game(), 0, 0, 10, [16, 11]);
    s.bonus = true;
    expect(legalActions(s)).toEqual([{ type: "roll" }]);
  });

  it("does not pay Q when collapsing onto a Node", () => {
    const s = split(game(), 0, 0, 2, [8, 3]);
    expect(apply(s, { type: "collapse", marker: 0 }).state.players[0]!.q).toBe(1);
  });
});

describe("hitting a superposed token", () => {
  // Red split from 18 with a roll of 2: markers on absolute 20 and 23. Green lands on 20.
  const setup = () => withRoll(place(split(game(), 0, 0, 18, [20, 23]), 1, [rel("green", 17)]), 3, 1);

  it("captures on heads, scoring the split-capture bonus", () => {
    const { state, events } = apply(setup(), { type: "move", token: 0 }, [HEADS]);
    const [red, green] = state.players;
    expect(red!.tokens[0]).toEqual({ pos: YARD, split: null, drifting: false });
    expect(green!.score.captures).toBe(4);
    expect(red!.q).toBe(2);
    expect(events).toContainEqual({ type: "hit", seat: 1, victim: { seat: 0, token: 0 }, marker: 0, success: true });
  });

  it("collapses to the other marker on tails, and the attacker stays", () => {
    const { state } = apply(setup(), { type: "move", token: 0 }, [TAILS]);
    expect(state.players[0]!.tokens[0]).toEqual({ pos: 23, split: null, drifting: false });
    expect(state.players[1]!.tokens[0]!.pos).toBe(rel("green", 20));
    expect(state.players[1]!.score.captures).toBe(0);
  });

  it("cannot hit a marker on a safe square", () => {
    // Markers on 21 (a star) and 16. The scripted RNG has no coin, so any flip would throw.
    const s = withRoll(place(split(game(), 0, 0, 15, [21, 16]), 1, [rel("green", 18)]), 3, 1);
    const { state } = apply(s, { type: "move", token: 0 });
    expect(state.players[0]!.tokens[0]!.split).toEqual([21, 16]);
  });
});

describe("scoring a token still in superposition", () => {
  it("counts the less-advanced marker", () => {
    const s = split(game(), 0, 0, 10, [12, 15]);
    expect(finalScores(s)[0]!.progress).toBe(Math.floor(12 / 5));
  });
});

describe("holding a superposition open", () => {
  it("lets the owner hold once, then play the turn as normal", () => {
    const { state, events } = apply(split(game(), 0, 0, 10, [12, 15]), { type: "hold" });
    expect(state.players[0]!.tokens[0]!.split).toEqual([12, 15]);
    expect(state.players[0]!.splitHolds).toBe(1);
    expect(legalActions(state)).toEqual([{ type: "roll" }]);
    expect(events).toContainEqual({ type: "held", seat: 0, token: 0, turnsLeft: 0 });
  });

  it("forces a collapse at the start of the following turn", () => {
    const s = split(game(), 0, 0, 10, [12, 15]);
    s.players[0]!.splitHolds = 1;
    expect(types(legalActions(s))).toEqual(["collapse", "collapse"]);
  });

  it("can be switched off with splitMaxTurns = 1", () => {
    const s = split(game({ rules: { splitMaxTurns: 1 } }), 0, 0, 10, [12, 15]);
    expect(types(legalActions(s))).not.toContain("hold");
  });

  it("resets the hold count for a new superposition", () => {
    const s = withRoll(place(game(), 0, [10]), 2);
    s.players[0]!.splitHolds = 1;
    expect(apply(s, { type: "superpose", token: 0 }).state.players[0]!.splitHolds).toBe(0);
  });

  it("keeps the held token exposed to hits and Force across another round", () => {
    const held = apply(split(game(), 0, 0, 18, [20, 23]), { type: "hold" }).state;
    place(held, 1, [rel("green", 17)]);
    const { state } = apply(withRoll(held, 3, 1), { type: "move", token: 0 }, [HEADS]);
    expect(state.players[0]!.tokens[0]!.pos).toBe(YARD);
  });
});
