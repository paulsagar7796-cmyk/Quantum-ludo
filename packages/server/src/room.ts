import { createBot, type PersonalityId } from "@qludo/bots";
import {
  SeededRng,
  applyAction,
  createGame,
  isLegal,
  type Action,
  type GameEvent,
  type GameState,
  type ObservationMode,
  type PlayerCount,
  type Rng,
} from "@qludo/engine";

/**
 * Online rooms: the server is the authority. It owns the RNG, checks every action and plays the
 * bots. Each update records the random numbers it used, so clients can replay the same moves
 * (with their animations) without ever being able to predict the dice.
 */

export interface RoomSeat {
  /** human = a person joins over the internet; bot = played by the server. */
  kind: "human" | "bot";
  bot: PersonalityId;
  name: string;
}

export interface RoomMatch {
  playerCount: PlayerCount;
  observationMode: ObservationMode;
  seats: RoomSeat[];
}

/** One action as clients replay it: who acted, what, and the random numbers it consumed. */
export interface Step {
  seat: number;
  action: Action;
  randoms: number[];
}

export interface Room {
  code: string;
  status: "lobby" | "playing" | "over";
  match: RoomMatch;
  state: GameState | null;
  /** Bumped on every change, so clients can tell whether they missed an update. */
  version: number;
  /** The actions applied by the latest update, oldest first. */
  steps: Step[];
}

export class RoomError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/** Wraps the seeded RNG and remembers every number it hands out. */
class RecordingRng implements Rng {
  readonly used: number[] = [];
  constructor(private readonly inner: SeededRng) {}
  next(): number {
    const v = this.inner.next();
    this.used.push(v);
    return v;
  }
}

/** Replays recorded numbers; throws if a client's replay asks for more than the server used. */
export class ReplayRng implements Rng {
  private i = 0;
  constructor(private readonly values: number[]) {}
  next(): number {
    if (this.i >= this.values.length) throw new Error("Replay needs more randomness than recorded");
    return this.values[this.i++]!;
  }
}

const MAX_BOT_STEPS = 400;
/** Room codes avoid look-alike characters (0/O, 1/I/L). */
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function makeRoomCode(random: () => number): string {
  return Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(random() * CODE_CHARS.length)]).join("");
}

export function validateMatch(match: RoomMatch): RoomMatch {
  if (![2, 3, 4].includes(match.playerCount)) throw new RoomError("Choose 2 to 4 players.");
  if (!["coin", "choice"].includes(match.observationMode)) throw new RoomError("Unknown Force mode.");
  if (!Array.isArray(match.seats) || match.seats.length < match.playerCount) throw new RoomError("Missing seats.");
  const seats = match.seats.slice(0, 4).map((s) => ({
    kind: s.kind === "bot" ? ("bot" as const) : ("human" as const),
    bot: s.bot,
    name: String(s.name ?? "").slice(0, 16),
  }));
  if (!seats.slice(0, match.playerCount).some((s) => s.kind === "human")) {
    throw new RoomError("An online room needs at least one person.");
  }
  return { playerCount: match.playerCount, observationMode: match.observationMode, seats };
}

export function newRoom(code: string, match: RoomMatch): Room {
  return { code, status: "lobby", match: validateMatch(match), state: null, version: 0, steps: [] };
}

function applyStep(state: GameState, seat: number, action: Action, rng: SeededRng): { state: GameState; step: Step } {
  const rec = new RecordingRng(rng);
  const res = applyAction(state, action, rec);
  return { state: res.state, step: { seat, action, randoms: rec.used } };
}

/** Lets every bot whose turn it is play, until a person is up or the game ends. */
function runBots(room: Room, state: GameState, rng: SeededRng, steps: Step[]): GameState {
  let s = state;
  const bots = room.match.seats.map((seat, i) => (seat.kind === "bot" ? createBot(seat.bot, i + 1) : null));
  for (let n = 0; n < MAX_BOT_STEPS && s.phase !== "over"; n++) {
    const bot = bots[s.current];
    if (!bot) break;
    const r = applyStep(s, s.current, bot.choose(s), rng);
    s = r.state;
    steps.push(r.step);
  }
  return s;
}

function finish(room: Room, state: GameState, steps: Step[]): Room {
  return {
    ...room,
    state,
    steps,
    status: state.phase === "over" ? "over" : "playing",
    version: room.version + 1,
  };
}

/** Starts (or restarts) the game. `rngState` is the server's secret seed; the new value is returned. */
export function startGame(room: Room, rngState: number): { room: Room; rngState: number } {
  const open = room.match.seats.slice(0, room.match.playerCount).filter((s) => s.kind === "human" && !s.name);
  if (open.length > 0) throw new RoomError("Wait for everyone to join, or give empty seats to bots.");
  const rng = new SeededRng(0);
  rng.setState(rngState);
  const steps: Step[] = [];
  const fresh = createGame({ playerCount: room.match.playerCount, observationMode: room.match.observationMode });
  const state = runBots(room, fresh, rng, steps);
  return { room: finish(room, state, steps), rngState: rng.getState() };
}

/** A person's action. Only accepted on their own turn and only if it is legal. */
export function act(room: Room, rngState: number, seat: number, action: Action): { room: Room; rngState: number } {
  const state = room.state;
  if (room.status !== "playing" || !state) throw new RoomError("The game is not running.", 409);
  if (state.current !== seat) throw new RoomError("It is not your turn.", 409);
  if (!isLegal(state, action)) throw new RoomError("That move is not allowed right now.", 409);
  const rng = new SeededRng(0);
  rng.setState(rngState);
  const first = applyStep(state, seat, action, rng);
  const steps = [first.step];
  const next = runBots(room, first.state, rng, steps);
  return { room: finish(room, next, steps), rngState: rng.getState() };
}

/** Hand a seat to a bot (e.g. a player who left). Plays it at once if it is that seat's turn. */
export function seatToBot(room: Room, rngState: number, seat: number): { room: Room; rngState: number } {
  if (seat < 0 || seat >= room.match.playerCount) throw new RoomError("No such seat.");
  const seats = room.match.seats.map((s, i) => (i === seat ? { ...s, kind: "bot" as const, name: "" } : s));
  const updated: Room = { ...room, match: { ...room.match, seats } };
  if (room.status !== "playing" || !room.state)
    return { room: { ...updated, version: room.version + 1, steps: [] }, rngState };
  const rng = new SeededRng(0);
  rng.setState(rngState);
  const steps: Step[] = [];
  const next = runBots(updated, room.state, rng, steps);
  return { room: finish(updated, next, steps), rngState: rng.getState() };
}

/**
 * Deep equality that ignores object key order. Postgres `jsonb` reorders keys, so a state read
 * back from the database must be compared by content, not as JSON text.
 */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = b as unknown[];
    return a.length === bb.length && a.every((v, i) => sameValue(v, bb[i]));
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return (
    ka.length === kb.length &&
    ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && sameValue((a as never)[k], (b as never)[k]))
  );
}

/**
 * Client side: rebuild the states and events of an update from the previous state and its steps.
 * Returns null if the replay doesn't reproduce the server's state (then trust the server's state).
 */
export function replaySteps(
  from: GameState,
  steps: Step[],
  expected: GameState,
): { states: GameState[]; events: GameEvent[][] } | null {
  try {
    let s = from;
    const states: GameState[] = [];
    const events: GameEvent[][] = [];
    for (const step of steps) {
      const res = applyAction(s, step.action, new ReplayRng(step.randoms));
      s = res.state;
      states.push(s);
      events.push(res.events);
    }
    return sameValue(s, expected) ? { states, events } : null;
  } catch {
    return null;
  }
}
