import { describe, expect, it } from "vitest";
import { legalActions, raceLeader } from "../src";
import { HEADS, apply, game, place, rel, split, types, withRoll } from "./helpers";

// Red (seat 0) has a token split between 20 and 23. Green (seat 1) is to act with a 3.
// Green is ahead in the race, so Forcing Red costs the usual 1 Q.
const setup = (mode: "coin" | "choice") =>
  withRoll(place(split(game({ observationMode: mode }), 0, 0, 18, [20, 23]), 1, [30]), 3, 1);

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

describe("Force is free against the race leader", () => {
  // Red leads (a split token well along the track); Green has no Q left.
  const redLeads = (opts: Parameters<typeof game>[0] = {}) => {
    const s = withRoll(place(split(game(opts), 0, 0, 18, [20, 23]), 1, [5]), 3, 1);
    s.players[1]!.q = 0;
    return s;
  };

  it("lets a player with no Q Force the leader's token, for free", () => {
    const s = redLeads();
    expect(raceLeader(s)).toBe(0);
    expect(legalActions(s)).toContainEqual({ type: "observe", target });
    const { state, events } = apply(s, { type: "observe", target }, [HEADS]);
    expect(state.players[1]!.q).toBe(0);
    expect(events).toContainEqual({ type: "observed", seat: 1, target, mode: "coin", free: true });
    expect(events.some((e) => e.type === "qSpent")).toBe(false);
  });

  it("does not spend Q even when the player has some", () => {
    const s = redLeads();
    s.players[1]!.q = 2;
    expect(apply(s, { type: "observe", target }, [HEADS]).state.players[1]!.q).toBe(2);
  });

  it("is not free when two players are level for the lead", () => {
    const s = redLeads();
    place(s, 2, [20]); // Yellow is exactly as far along as Red
    expect(raceLeader(s)).toBeNull();
    expect(types(legalActions(s))).not.toContain("observe");
  });

  it("can be switched off", () => {
    expect(types(legalActions(redLeads({ rules: { freeForceOnLeader: false } })))).not.toContain("observe");
  });

  it("ranks the race by tokens home before distance, ignoring finished players", () => {
    const s = place(game(), 0, [50, 50, 50, 50]);
    place(s, 1, [56, -1, -1, -1]);
    expect(raceLeader(s)).toBe(1);
    s.players[1]!.finished = true;
    expect(raceLeader(s)).toBe(0);
  });
});
