import { describe, expect, it } from "vitest";
import { cuesFor } from "./sound";

const sounds = (cues: ReturnType<typeof cuesFor>) => cues.map((c) => c.sound);

describe("sound cues", () => {
  it("rattles the die on a roll", () => {
    expect(sounds(cuesFor([{ type: "rolled", seat: 0, value: 4 }]))).toEqual(["dice"]);
  });

  it("plays one rising hop per square moved, then the capture", () => {
    const cues = cuesFor([
      { type: "moved", seat: 0, token: 0, from: 3, to: 7, via: "move" },
      { type: "captured", seat: 0, victim: { seat: 1, token: 0 }, square: 7, wasSplit: false },
    ]);
    expect(sounds(cues)).toEqual(["hop", "hop", "hop", "hop", "capture"]);
    expect(cues.slice(0, 4).map((c) => c.step)).toEqual([0, 1, 2, 3]);
    expect(cues[4]!.at).toBeGreaterThan(cues[3]!.at);
  });

  it("gives each quantum mechanic its own sound", () => {
    expect(sounds(cuesFor([{ type: "superposed", seat: 0, token: 0, markers: [12, 15] }]))).toEqual(["split"]);
    expect(sounds(cuesFor([{ type: "entangled", seat: 0, tokens: [0, 1] }]))).toEqual(["link"]);
    expect(sounds(cuesFor([{ type: "moved", seat: 0, token: 0, from: 3, to: 7, via: "ghost" }]))).toEqual(["ghost"]);
    expect(sounds(cuesFor([{ type: "observed", seat: 0, target: { seat: 1, token: 0 }, mode: "coin" }]))).toEqual(["force"]);
  });

  it("flips a coin on a marker hit, and whiffs on a miss", () => {
    const miss = cuesFor([{ type: "hit", seat: 1, victim: { seat: 0, token: 0 }, marker: 0, success: false }]);
    expect(sounds(miss)).toEqual(["coin", "miss"]);
  });

  it("pings only at the start of a human's turn", () => {
    const start = { type: "turnStart", seat: 0, round: 2, bonus: false } as const;
    expect(sounds(cuesFor([start], new Set([0])))).toEqual(["yourTurn"]);
    expect(sounds(cuesFor([start], new Set([1])))).toEqual([]);
    expect(sounds(cuesFor([{ ...start, bonus: true }], new Set([0])))).toEqual([]);
  });
});
