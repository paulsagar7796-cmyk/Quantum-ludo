import { describe, expect, it } from "vitest";
import { legalActions } from "../src";
import { HEADS, apply, game, place, rel, split, types, withRoll } from "./helpers";

// Red (seat 0) has a token split between 20 and 23. Green (seat 1) is to act with a 3.
const setup = (mode: "coin" | "choice") =>
  withRoll(place(split(game({ observationMode: mode }), 0, 0, 18, [20, 23]), 1, [5]), 3, 1);

const target = { seat: 0, token: 0 };

describe("Observation in Chaos (coin) mode", () => {
  it("collapses the target by coin flip as a free action", () => {
    const s = setup("coin");
    expect(legalActions(s)).toContainEqual({ type: "observe", target });
    const { state, events } = apply(s, { type: "observe", target }, [HEADS]);
    expect(state.players[0]!.tokens[0]).toEqual({ pos: 20, split: null, drifting: false });
    expect(state.players[1]!.q).toBe(0);
    expect(state.phase).toBe("act");
    expect(state.current).toBe(1);
    expect(events).toContainEqual({ type: "collapsed", seat: 0, token: 0, to: 20, cause: "observe" });
  });

  it("allows only one observation per roll", () => {
    const s = setup("coin");
    s.players[1]!.q = 3;
    split(s, 2, 0, 5, [7, 10]);
    const { state } = apply(s, { type: "observe", target }, [HEADS]);
    expect(types(legalActions(state))).not.toContain("observe");
  });

  it("needs Q", () => {
    const s = setup("coin");
    s.players[1]!.q = 0;
    expect(types(legalActions(s))).not.toContain("observe");
  });
});

describe("Observation in Tactical (choice) mode", () => {
  it("lets the observer choose the marker, with no coin", () => {
    const s = setup("choice");
    const actions = legalActions(s);
    expect(actions).toContainEqual({ type: "observe", target, marker: 0 });
    expect(actions).toContainEqual({ type: "observe", target, marker: 1 });
    const { state } = apply(s, { type: "observe", target, marker: 1 });
    expect(state.players[0]!.tokens[0]).toEqual({ pos: 23, split: null, drifting: false });
  });

  it("is a free action: the observer still moves with the same roll", () => {
    const { state } = apply(setup("choice"), { type: "observe", target, marker: 0 });
    expect(state.phase).toBe("act");
    expect(state.current).toBe(1);
    expect(legalActions(state)).toContainEqual({ type: "move", token: 0 });
    expect(types(legalActions(state))).not.toContain("observe");
  });

  it("lets the observer measure then strike, with no coin", () => {
    // Green stands 3 behind marker 0 (absolute 20). Force it there, then land on it.
    const s = withRoll(
      place(split(game({ observationMode: "choice" }), 0, 0, 18, [20, 23]), 1, [rel("green", 17)]),
      3,
      1,
    );
    const forced = apply(s, { type: "observe", target, marker: 0 }).state;
    const { state } = apply(forced, { type: "move", token: 0 });
    expect(state.players[0]!.tokens[0]!.pos).toBe(-1);
    expect(state.players[1]!.score.captures).toBe(3); // a collapsed token is no longer split
  });
});
