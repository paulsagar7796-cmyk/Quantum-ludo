import { describe, expect, it } from "vitest";
import { legalActions } from "../src";
import { apply, game, place, rel, split, types, withRoll } from "./helpers";

const linked = (positions: number[]) => {
  const s = place(game(), 0, positions);
  s.players[0]!.link = [0, 1];
  return s;
};

describe("Entanglement (Link)", () => {
  it("links two track tokens for 1 Q as a free action", () => {
    const s = withRoll(place(game(), 0, [10, 20]), 4);
    expect(legalActions(s)).toContainEqual({ type: "entangle", tokens: [0, 1] });
    const { state } = apply(s, { type: "entangle", tokens: [0, 1] });
    expect(state.players[0]!.link).toEqual([0, 1]);
    expect(state.players[0]!.q).toBe(0);
    expect(state.phase).toBe("act");
    expect(types(legalActions(state))).not.toContain("entangle");
  });

  it("only links real tokens on the shared track", () => {
    const s = withRoll(split(place(game(), 0, [undefined, 10, undefined, 20]), 0, 0, 5, [7, 10]), 2);
    const entangles = legalActions(s).filter((a) => a.type === "entangle");
    expect(entangles).toEqual([{ type: "entangle", tokens: [1, 3] }]);
  });

  it("moves the partner half the roll, rounded down", () => {
    const { state } = apply(withRoll(linked([10, 20]), 5), { type: "move", token: 0 });
    expect(state.players[0]!.tokens.map((t) => t.pos).slice(0, 2)).toEqual([15, 22]);
  });

  it("does not move the partner on a roll of 1", () => {
    const { state } = apply(withRoll(linked([10, 20]), 1), { type: "move", token: 0 });
    expect(state.players[0]!.tokens[1]!.pos).toBe(20);
  });

  it("leaves the partner in place when its free move is blocked", () => {
    const s = place(linked([10, 20]), 1, [rel("green", 22), rel("green", 22)]);
    const { state } = apply(withRoll(s, 4), { type: "move", token: 0 });
    expect(state.players[0]!.tokens[1]!.pos).toBe(20);
  });

  it("knocks the partner back 6 squares when one token is captured", () => {
    const s = place(linked([18, 30]), 1, [rel("green", 15)]);
    const { state, events } = apply(withRoll(s, 3, 1), { type: "move", token: 0 });
    const red = state.players[0]!;
    expect(red.tokens[0]!.pos).toBe(-1);
    expect(red.tokens[1]!.pos).toBe(24);
    expect(red.link).toBeNull();
    expect(events).toContainEqual({ type: "knockback", seat: 0, token: 1, from: 30, to: 24 });
  });

  it("never knocks a partner behind its start square", () => {
    const s = place(linked([18, 3]), 1, [rel("green", 15)]);
    expect(apply(withRoll(s, 3, 1), { type: "move", token: 0 }).state.players[0]!.tokens[1]!.pos).toBe(0);
  });

  it("steps back past opponents so the retreat never captures", () => {
    const s = place(place(linked([18, 30]), 1, [rel("green", 15)]), 2, [rel("yellow", 24)]);
    const { state } = apply(withRoll(s, 3, 1), { type: "move", token: 0 });
    expect(state.players[0]!.tokens[1]!.pos).toBe(23);
    expect(state.players[2]!.tokens[0]!.pos).toBe(rel("yellow", 24));
  });

  it("ends when a linked token enters the home column", () => {
    const { state, events } = apply(withRoll(linked([48, 10]), 4), { type: "move", token: 0 });
    expect(state.players[0]!.tokens[0]!.pos).toBe(52);
    expect(state.players[0]!.tokens[1]!.pos).toBe(12);
    expect(state.players[0]!.link).toBeNull();
    expect(events).toContainEqual({ type: "decoupled", seat: 0, reason: "homeColumn" });
  });

  it("can be decoupled for free at the start of a turn, but not on a bonus roll", () => {
    const s = linked([10, 20]);
    expect(legalActions(s)).toContainEqual({ type: "decouple" });
    expect(apply(s, { type: "decouple" }).state.players[0]!.link).toBeNull();
    s.bonus = true;
    expect(types(legalActions(s))).not.toContain("decouple");
  });
});
