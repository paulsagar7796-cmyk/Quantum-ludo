import { createGame } from "@qludo/engine";
import { describe, expect, it } from "vitest";
import { effectsFor } from "./effects";
import { HOP_MS } from "./useWalk";

const state = createGame({ playerCount: 4 });

describe("board effects", () => {
  it("bursts a capture where it happened, after the attacker has hopped there", () => {
    const fx = effectsFor(
      [
        { type: "moved", seat: 0, token: 0, from: 3, to: 7, via: "move" },
        { type: "captured", seat: 0, victim: { seat: 1, token: 0 }, square: 7, wasSplit: false },
      ],
      state,
      1,
    );
    expect(fx).toHaveLength(1);
    expect(fx[0]).toMatchObject({ kind: "capture", point: { x: 6.5, y: 3.5 }, delayMs: 4 * HOP_MS });
  });

  it("ripples both Split markers straight away", () => {
    const fx = effectsFor([{ type: "superposed", seat: 0, token: 0, markers: [12, 15] }], state, 2);
    expect(fx.map((f) => [f.kind, f.delayMs])).toEqual([
      ["split", 0],
      ["split", 0],
    ]);
  });

  it("marks Ghost moves, Force collapses, Node harvests and tokens home", () => {
    const kinds = effectsFor(
      [
        { type: "moved", seat: 0, token: 0, from: 2, to: 5, via: "ghost" },
        { type: "qGained", seat: 0, amount: 1, reason: "node", square: 8 },
        { type: "collapsed", seat: 1, token: 0, to: 20, cause: "observe" },
        { type: "tokenHome", seat: 0, token: 1 },
      ],
      state,
      3,
    ).map((f) => f.kind);
    expect(kinds).toEqual(["ghost", "node", "force", "home"]);
  });

  it("gives every effect a unique id", () => {
    const ids = effectsFor([{ type: "superposed", seat: 0, token: 0, markers: [12, 15] }], state, 4).map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
