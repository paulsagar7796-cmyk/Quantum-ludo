import { SeededRng, legalActions, type Action } from "@qludo/engine";
import { describe, expect, it } from "vitest";
import {
  RoomError,
  act,
  makeRoomCode,
  newRoom,
  replaySteps,
  seatToBot,
  startGame,
  type Room,
  type RoomMatch,
} from "../src";

const match = (kinds: ("human" | "bot")[], names: string[] = []): RoomMatch => ({
  playerCount: kinds.length as 2 | 3 | 4,
  observationMode: "choice",
  seats: [0, 1, 2, 3].map((i) => ({
    kind: kinds[i] ?? "bot",
    bot: (["hunter", "racer", "gambler", "banker"] as const)[i]!,
    name: names[i] ?? (kinds[i] === "human" ? `P${i + 1}` : ""),
  })),
});

describe("room codes", () => {
  it("are 5 characters with no look-alikes", () => {
    const rng = new SeededRng(1);
    for (let i = 0; i < 200; i++) expect(makeRoomCode(() => rng.next())).toMatch(/^[A-HJKMNP-Z2-9]{5}$/);
  });
});

describe("starting", () => {
  it("waits until every human seat has a player", () => {
    const room = newRoom("ABCDE", match(["human", "human"], ["Paul", ""]));
    expect(() => startGame(room, 1)).toThrow(RoomError);
  });

  it("needs at least one person", () => {
    expect(() => newRoom("ABCDE", match(["bot", "bot"]))).toThrow("at least one person");
  });

  it("starts the game and bumps the version", () => {
    const { room } = startGame(newRoom("ABCDE", match(["human", "bot"])), 7);
    expect(room.status).toBe("playing");
    expect(room.version).toBe(1);
    expect(room.state!.current).toBe(0);
  });

  it("lets bots play straight away when a bot sits first", () => {
    const { room } = startGame(newRoom("ABCDE", match(["bot", "human"])), 7);
    expect(room.steps.length).toBeGreaterThan(0);
    expect(room.steps.every((s) => s.seat === 0)).toBe(true);
    expect(room.state!.current).toBe(1);
  });
});

describe("acting", () => {
  const started = () => startGame(newRoom("ABCDE", match(["human", "human"])), 11);

  it("rejects actions out of turn and illegal actions", () => {
    const { room, rngState } = started();
    expect(() => act(room, rngState, 1, { type: "roll" })).toThrow("not your turn");
    expect(() => act(room, rngState, 0, { type: "move", token: 0 })).toThrow("not allowed");
  });

  it("records the random numbers a roll used", () => {
    const { room, rngState } = started();
    const next = act(room, rngState, 0, { type: "roll" });
    expect(next.room.version).toBe(2);
    expect(next.room.steps).toEqual([{ seat: 0, action: { type: "roll" }, randoms: [expect.any(Number)] }]);
    expect(next.rngState).not.toBe(rngState);
  });

  it("can hand a seat to a bot, which then plays its turn", () => {
    const { room, rngState } = started();
    const handed = seatToBot(room, rngState, 0);
    expect(handed.room.match.seats[0]!.kind).toBe("bot");
    expect(handed.room.steps.length).toBeGreaterThan(0);
    expect(handed.room.state!.current).toBe(1);
  });
});

describe("client replay", () => {
  it("reproduces every server update exactly, through whole games with bots", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const pick = new SeededRng(seed * 31);
      let { room, rngState } = startGame(newRoom("ABCDE", match(["human", "bot", "human", "bot"])), seed);
      let client = room.state!;
      for (let n = 0; n < 5000 && room.status === "playing"; n++) {
        const legal = legalActions(room.state!);
        const action: Action = legal[Math.floor(pick.next() * legal.length)]!;
        const before = room;
        ({ room, rngState } = act(room, rngState, room.state!.current, action));
        expect(room.version).toBe(before.version + 1);
        const replay = replaySteps(client, room.steps, room.state!);
        expect(replay).not.toBeNull();
        expect(replay!.states.at(-1)).toEqual(room.state);
        client = room.state!;
      }
      expect(room.status).toBe("over");
    }
  }, 60_000);

  it("matches a server state whose keys were reordered by the database", () => {
    // Postgres jsonb sorts keys (shorter first), so round-tripped states differ as JSON text.
    const reorder = (v: unknown): unknown =>
      Array.isArray(v)
        ? v.map(reorder)
        : v && typeof v === "object"
          ? Object.fromEntries(
              Object.entries(v)
                .sort(([a], [b]) => a.length - b.length || a.localeCompare(b))
                .map(([k, x]) => [k, reorder(x)]),
            )
          : v;
    const { room, rngState } = startGame(newRoom("ABCDE", match(["human", "bot"])), 5);
    const next = act(room, rngState, 0, { type: "roll" });
    const fromDb = reorder(next.room.state) as typeof next.room.state;
    expect(JSON.stringify(fromDb)).not.toBe(JSON.stringify(next.room.state));
    expect(replaySteps(room.state!, next.room.steps, fromDb!)).not.toBeNull();
  });

  it("detects a replay that doesn't match the server", () => {
    const { room, rngState } = startGame(newRoom("ABCDE", match(["human", "human"])), 3);
    const next = act(room, rngState, 0, { type: "roll" });
    const tampered: Room = { ...next.room, steps: [{ ...next.room.steps[0]!, randoms: [0.99] }] };
    expect(replaySteps(room.state!, tampered.steps, next.room.state!)).toBeNull();
  });
});
