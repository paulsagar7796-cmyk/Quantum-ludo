import { describe, expect, it } from "vitest";
import { HOME_POS, YARD, createGame, legalActions } from "../src";
import { apply, die, game, place, rel, types, withRoll } from "./helpers";

describe("setup", () => {
  it("creates 4 players with 1 Q and all tokens in the yard", () => {
    const s = game();
    expect(s.players.map((p) => p.color)).toEqual(["red", "green", "yellow", "blue"]);
    for (const p of s.players) {
      expect(p.q).toBe(1);
      expect(p.tokens.every((t) => t.pos === YARD && t.split === null)).toBe(true);
    }
    expect(s.phase).toBe("upkeep");
    expect(legalActions(s)).toEqual([{ type: "roll" }]);
  });

  it("seats two players on opposite colours", () => {
    expect(createGame({ playerCount: 2 }).players.map((p) => p.color)).toEqual(["red", "yellow"]);
  });

  it("is not mutated by applyAction", () => {
    const s = game();
    const before = JSON.stringify(s);
    apply(s, { type: "roll" }, [die(4)]);
    expect(JSON.stringify(s)).toBe(before);
  });

  it("rejects illegal actions", () => {
    expect(() => apply(game(), { type: "move", token: 0 })).toThrow(/Illegal/);
  });
});

describe("rolling and turns", () => {
  it("moves to the act phase with the rolled value", () => {
    const { state, events } = apply(game(), { type: "roll" }, [die(3)]);
    expect(state.phase).toBe("act");
    expect(state.roll).toBe(3);
    expect(events).toContainEqual({ type: "rolled", seat: 0, value: 3 });
  });

  it("only lets a token leave the yard on a 6, onto its start square, without paying Q", () => {
    expect(types(legalActions(withRoll(game(), 5)))).toEqual(["pass"]);
    const { state, events } = apply(withRoll(game(), 6), { type: "move", token: 0 });
    expect(state.players[0]!.tokens[0]!.pos).toBe(0);
    expect(state.players[0]!.q).toBe(1);
    expect(events.some((e) => e.type === "entered")).toBe(true);
  });

  it("gives a bonus roll after a 6", () => {
    const { state } = apply(withRoll(game(), 6), { type: "move", token: 0 });
    expect(state.current).toBe(0);
    expect(state.phase).toBe("upkeep");
    expect(state.bonus).toBe(true);
  });

  it("forfeits the third consecutive 6", () => {
    const s = game();
    s.sixStreak = 2;
    s.bonus = true;
    const { state, events } = apply(s, { type: "roll" }, [die(6)]);
    expect(events.some((e) => e.type === "forfeit")).toBe(true);
    expect(state.current).toBe(1);
    expect(state.sixStreak).toBe(0);
  });

  it("passes the turn after a non-6", () => {
    const s = withRoll(place(game(), 0, [5]), 3);
    expect(apply(s, { type: "move", token: 0 }).state.current).toBe(1);
  });

  it("forces a normal move when one exists", () => {
    const s = withRoll(place(game(), 0, [5]), 3);
    expect(types(legalActions(s))).not.toContain("pass");
  });
});

describe("home column", () => {
  it("needs an exact roll to reach home", () => {
    const s = place(game(), 0, [54]);
    expect(types(legalActions(withRoll(s, 3)))).toEqual(["pass"]);
    const { state, events } = apply(withRoll(s, 2), { type: "move", token: 0 });
    expect(state.players[0]!.tokens[0]!.pos).toBe(HOME_POS);
    expect(state.players[0]!.score.home).toBe(10);
    expect(events.some((e) => e.type === "tokenHome")).toBe(true);
  });
});

describe("captures", () => {
  it("captures a lone opponent on a normal square", () => {
    const s = place(place(game(), 0, [3]), 1, [rel("green", 7)]);
    const { state } = apply(withRoll(s, 4), { type: "move", token: 0 });
    const [red, green] = state.players;
    expect(green!.tokens[0]!.pos).toBe(YARD);
    expect(red!.score.captures).toBe(3);
    expect(green!.score.captured).toBe(-1);
    expect(green!.q).toBe(2); // +1 Q catch-up for being captured
  });

  it("does not capture on a safe square, and both tokens share it", () => {
    const s = place(place(game(), 0, [5]), 1, [rel("green", 8)]);
    const { state } = apply(withRoll(s, 3), { type: "move", token: 0 });
    expect(state.players[1]!.tokens[0]!.pos).toBe(rel("green", 8));
    expect(state.players[0]!.tokens[0]!.pos).toBe(8);
  });
});

describe("blockades", () => {
  const blockaded = () => place(place(game(), 0, [3]), 1, [rel("green", 5), rel("green", 5)]);

  it("blocks passing an opposing blockade", () => {
    const actions = legalActions(withRoll(blockaded(), 4));
    expect(actions).toContainEqual({ type: "pass" });
    expect(actions).not.toContainEqual({ type: "move", token: 0 });
  });

  it("blocks landing on an opposing blockade", () => {
    const s = withRoll(blockaded(), 2);
    s.players[0]!.q = 0;
    expect(types(legalActions(s))).toEqual(["pass"]);
  });

  it("does not form blockades on safe squares", () => {
    const s = place(place(game(), 0, [5]), 1, [rel("green", 8), rel("green", 8)]);
    expect(legalActions(withRoll(s, 6))).toContainEqual({ type: "move", token: 0 });
  });
});
