import { describe, expect, it } from "vitest";
import { statsOf, type GameRecord } from "./history";

function game(myPlace: number | null, myTotal = 40): GameRecord {
  const players: GameRecord["players"] = [
    { seat: 0, name: "You", color: "red", mine: myPlace !== null, bot: false, place: myPlace ?? 2, total: myTotal },
    { seat: 1, name: "The Racer", color: "yellow", mine: false, bot: true, place: myPlace === 1 ? 2 : 1, total: 30 },
  ];
  return {
    id: String(Math.random()),
    endedAt: 0,
    mode: "local",
    observationMode: "coin",
    rounds: 60,
    reason: "finish",
    players,
  };
}

describe("stats", () => {
  it("counts games, wins, win rate, average and best score for this device's players", () => {
    const s = statsOf([game(1, 60), game(2, 20), game(1, 70), game(2, 30)]);
    expect(s).toEqual({ games: 4, wins: 2, winRate: 0.5, averageScore: 45, bestScore: 70 });
  });

  it("ignores games with no player from this device (e.g. watching bots)", () => {
    expect(statsOf([game(null)]).games).toBe(0);
  });

  it("uses the best-placed local player in hot-seat games", () => {
    const g = game(2, 20);
    g.players.push({ seat: 2, name: "Sam", color: "green", mine: true, bot: false, place: 1, total: 55 });
    g.players[1]!.place = 3;
    expect(statsOf([g])).toMatchObject({ wins: 1, bestScore: 55 });
  });

  it("is all zeros with no history", () => {
    expect(statsOf([])).toEqual({ games: 0, wins: 0, winRate: 0, averageScore: 0, bestScore: 0 });
  });
});
