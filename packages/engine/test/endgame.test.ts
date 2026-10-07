import { describe, expect, it } from "vitest";
import { HOME_POS, finalScores, legalActions, placement } from "../src";
import { apply, game, place, withRoll } from "./helpers";

const nearlyDone = (opts: Parameters<typeof game>[0] = {}) => {
  const s = place(game(opts), 0, [54, HOME_POS, HOME_POS, HOME_POS]);
  s.players[0]!.score.home = 30;
  return withRoll(s, 2);
};

describe("end of game", () => {
  it("ends when the first player gets all tokens home, with the finish bonus", () => {
    const { state, events } = apply(nearlyDone(), { type: "move", token: 0 });
    expect(state.phase).toBe("over");
    expect(state.finishOrder).toEqual([0]);
    expect(state.result!.reason).toBe("finish");
    expect(state.result!.ranking[0]).toBe(0);
    const red = state.result!.scores[0]!;
    expect(red).toMatchObject({ home: 40, finishBonus: 15, progress: 0, unspentQ: 1, total: 56 });
    expect(events.at(-1)!.type).toBe("gameOver");
    expect(legalActions(state)).toEqual([]);
  });

  it("keeps playing in allButOne mode and skips finished players", () => {
    const { state } = apply(nearlyDone({ playerCount: 3, endCondition: "allButOne" }), { type: "move", token: 0 });
    expect(state.phase).toBe("upkeep");
    expect(state.current).toBe(1);
    expect(state.players[0]!.finished).toBe(true);

    const s2 = withRoll(state, 3, 2);
    expect(apply(s2, { type: "pass" }).state.current).toBe(1); // seat 0 is skipped
  });

  it("ends in allButOne mode when only one player is left", () => {
    const { state } = apply(nearlyDone({ playerCount: 2, endCondition: "allButOne" }), { type: "move", token: 0 });
    expect(state.phase).toBe("over");
  });

  it("ends at the round cap", () => {
    const s = withRoll(game({ rules: { roundCap: 1 } }), 3, 3);
    const { state } = apply(s, { type: "pass" });
    expect(state.phase).toBe("over");
    expect(state.result!.reason).toBe("roundCap");
    expect(state.result!.rounds).toBe(1);
  });
});

describe("placement", () => {
  it("ranks non-finishers by tokens home first, and awards 8 and 4 to 2nd and 3rd", () => {
    const s = place(game(), 0, [54, HOME_POS, HOME_POS, HOME_POS]);
    place(s, 1, [50, 50, 50, 50]); // 0 home, 24 squares to go
    place(s, 2, [HOME_POS, HOME_POS, -1, -1]); // 2 home, 114 to go
    const { state } = apply(withRoll(s, 2), { type: "move", token: 0 });
    expect(state.result!.ranking).toEqual([0, 2, 1, 3]);
    expect(state.result!.scores.map((x) => x.finishBonus)).toEqual([15, 4, 8, 0]);
  });

  it("breaks equal tokens home by distance to home", () => {
    const s = place(game(), 1, [HOME_POS, 10, 0, 0]); // 1 home, 158 to go
    place(s, 2, [HOME_POS, 40, 0, 0]); // 1 home, 128 to go
    expect(placement(s).slice(0, 2)).toEqual([2, 1]);
  });

  it("awards placement bonuses at the mercy cap too", () => {
    const s = withRoll(place(game({ rules: { roundCap: 1 } }), 2, [30]), 3, 3);
    const { state } = apply(s, { type: "pass" });
    expect(state.result!.ranking[0]).toBe(2);
    expect(state.result!.scores[2]!.finishBonus).toBe(15);
  });
});

describe("final scores", () => {
  it("counts progress for tokens not home and caps unspent Q at 2", () => {
    const s = place(game(), 0, [10, 20, -1, HOME_POS]);
    s.players[0]!.q = 4;
    s.players[0]!.score = { home: 10, captures: 3, captured: -1 };
    expect(finalScores(s, [1, 2, 3, 0])[0]).toMatchObject({ progress: 6, unspentQ: 2, finishBonus: 0, total: 10 + 3 - 1 + 6 + 2 });
  });
});
