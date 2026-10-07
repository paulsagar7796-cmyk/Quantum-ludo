import { describe, expect, it } from "vitest";
import { YARD, legalActions } from "../src";
import { apply, drift, game, place, rel, split, types, withRoll } from "./helpers";

describe("Ghost (drift)", () => {
  it("moves normally for 1 Q and starts drifting", () => {
    const s = withRoll(place(game(), 0, [10]), 4);
    expect(legalActions(s)).toContainEqual({ type: "ghost", token: 0 });
    const { state, events } = apply(s, { type: "ghost", token: 0 });
    const t = state.players[0]!.tokens[0]!;
    expect(t).toEqual({ pos: 14, split: null, drifting: true });
    expect(state.players[0]!.q).toBe(0);
    expect(events).toContainEqual({ type: "qSpent", seat: 0, mechanic: "ghost" });
    expect(events).toContainEqual({ type: "moved", seat: 0, token: 0, from: 10, to: 14, via: "ghost" });
  });

  it("cannot enter the home column", () => {
    expect(types(legalActions(withRoll(place(game(), 0, [48]), 4)))).not.toContain("ghost");
    expect(legalActions(withRoll(place(game(), 0, [46]), 4))).toContainEqual({ type: "ghost", token: 0 });
  });

  it("needs Q and a real token on the shared track", () => {
    const noQ = withRoll(place(game(), 0, [10]), 4);
    noQ.players[0]!.q = 0;
    expect(types(legalActions(noQ))).not.toContain("ghost");
    expect(types(legalActions(withRoll(game(), 6)))).not.toContain("ghost");
    expect(types(legalActions(withRoll(split(game(), 0, 0, 10, [12, 15]), 2)))).not.toContain("ghost");
  });

  it("does not capture when it lands on an opponent; both stay", () => {
    const s = place(place(game(), 0, [3]), 1, [rel("green", 7)]);
    const { state } = apply(withRoll(s, 4), { type: "ghost", token: 0 });
    expect(state.players[1]!.tokens[0]!.pos).toBe(rel("green", 7));
    expect(state.players[0]!.tokens[0]!.pos).toBe(7);
    expect(state.players[0]!.score.captures).toBe(0);
  });

  it("does not hit a marker it lands on", () => {
    // No scripted coin: any flip would throw.
    const s = split(place(game(), 0, [3]), 1, 0, rel("green", 5), [rel("green", 7), rel("green", 10)]);
    const { state } = apply(withRoll(s, 4), { type: "ghost", token: 0 });
    expect(state.players[1]!.tokens[0]!.split).not.toBeNull();
  });

  it("cannot be captured while drifting", () => {
    const s = drift(place(place(game(), 0, [7]), 1, [rel("green", 4)]), 0, 0);
    const { state } = apply(withRoll(s, 3, 1), { type: "move", token: 0 });
    expect(state.players[0]!.tokens[0]!.pos).toBe(7);
    expect(state.players[1]!.tokens[0]!.pos).toBe(rel("green", 7));
  });

  it("passes and lands on blockades", () => {
    const s = place(place(game(), 0, [3]), 1, [rel("green", 5), rel("green", 5)]);
    expect(legalActions(withRoll(s, 4))).toContainEqual({ type: "ghost", token: 0 });
    expect(legalActions(withRoll(s, 2))).toContainEqual({ type: "ghost", token: 0 });
  });

  it("still harvests a Node it lands on", () => {
    const { state } = apply(withRoll(place(game(), 0, [5]), 3), { type: "ghost", token: 0 });
    expect(state.players[0]!.q).toBe(1); // paid 1, earned 1
  });

  it("lasts through opponents' turns and ends at the start of the owner's next turn", () => {
    let s = apply(withRoll(place(game({ playerCount: 2 }), 0, [10]), 4), { type: "ghost", token: 0 }).state;
    expect(s.current).toBe(1);
    expect(s.players[0]!.tokens[0]!.drifting).toBe(true);
    const { state, events } = apply(withRoll(s, 3), { type: "pass" });
    s = state;
    expect(s.current).toBe(0);
    expect(s.players[0]!.tokens[0]!.drifting).toBe(false);
    expect(events).toContainEqual({ type: "solidified", seat: 0, token: 0 });
  });

  it("keeps drifting through the owner's bonus roll, with the same limits", () => {
    const s = apply(withRoll(place(game(), 0, [42]), 6), { type: "ghost", token: 0 }).state;
    expect(s.bonus).toBe(true);
    expect(s.players[0]!.tokens[0]).toMatchObject({ pos: 48, drifting: true });
    // 48 + 4 would enter the home column, which a drifting token cannot do.
    expect(legalActions(withRoll(s, 4))).not.toContainEqual({ type: "move", token: 0 });
  });

  it("does not form a blockade", () => {
    const s = drift(place(place(game(), 0, [5, 5]), 1, [rel("green", 2)]), 0, 0);
    expect(legalActions(withRoll(s, 4, 1))).toContainEqual({ type: "move", token: 0 });
  });

  it("is immune to the entanglement knockback", () => {
    const s = drift(place(place(game(), 0, [18, 30]), 1, [rel("green", 15)]), 0, 1);
    s.players[0]!.link = [0, 1];
    const { state } = apply(withRoll(s, 3, 1), { type: "move", token: 0 });
    expect(state.players[0]!.tokens[0]!.pos).toBe(YARD);
    expect(state.players[0]!.tokens[1]!.pos).toBe(30);
  });

  it("leaves shared squares behind: the next lander captures every lone token there", () => {
    // Green and yellow both sit on absolute 7 (after a drift ended there). Red lands on it.
    const s = place(place(place(game(), 0, [3]), 1, [rel("green", 7)]), 2, [rel("yellow", 7)]);
    const { state } = apply(withRoll(s, 4), { type: "move", token: 0 });
    expect(state.players[1]!.tokens[0]!.pos).toBe(YARD);
    expect(state.players[2]!.tokens[0]!.pos).toBe(YARD);
    expect(state.players[0]!.score.captures).toBe(6);
  });
});
