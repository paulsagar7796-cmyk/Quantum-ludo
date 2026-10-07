import { describe, expect, it } from "vitest";
import { apply, game, place, withRoll } from "./helpers";

describe("Quantum Nodes", () => {
  it("pays +1 Q for landing exactly on a Node", () => {
    const { state, events } = apply(withRoll(place(game(), 0, [5]), 3), { type: "move", token: 0 });
    expect(state.players[0]!.q).toBe(2);
    expect(state.nodeHarvestRound[8]).toBe(1);
    expect(events).toContainEqual({ type: "qGained", seat: 0, amount: 1, reason: "node", square: 8 });
  });

  it("pays nothing for passing over a Node", () => {
    const { state } = apply(withRoll(place(game(), 0, [5]), 4), { type: "move", token: 0 });
    expect(state.players[0]!.q).toBe(1);
  });

  it("is dormant for the rest of the round after paying out", () => {
    const s = withRoll(place(game(), 0, [5]), 3);
    s.nodeHarvestRound[8] = 1;
    expect(apply(s, { type: "move", token: 0 }).state.players[0]!.q).toBe(1);

    const next = withRoll(place(game(), 0, [5]), 3);
    next.nodeHarvestRound[8] = 1;
    next.round = 2;
    expect(apply(next, { type: "move", token: 0 }).state.players[0]!.q).toBe(2);
  });

  it("does not pay or go dormant when the player is at the Q cap", () => {
    const s = withRoll(place(game(), 0, [5]), 3);
    s.players[0]!.q = 4;
    const { state } = apply(s, { type: "move", token: 0 });
    expect(state.players[0]!.q).toBe(4);
    expect(state.nodeHarvestRound[8]).toBeUndefined();
  });

  it("pays for landing on another colour's start square", () => {
    const { state } = apply(withRoll(place(game(), 0, [10]), 3), { type: "move", token: 0 });
    expect(state.players[0]!.q).toBe(2); // absolute 13 is green's start square
  });
});
