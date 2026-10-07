import {
  START_SQUARE,
  TRACK_LENGTH,
  applyAction,
  createGame,
  freshFlags,
  type Action,
  type Color,
  type CreateGameOptions,
  type GameState,
  type Rng,
} from "../src";

/** Coin values for a scripted RNG. Heads (< 0.5) means the hit marker was real. */
export const HEADS = 0.25;
export const TAILS = 0.75;

/** RNG value that makes `rollDie` return `n`. */
export function die(n: number): number {
  return (n - 0.5) / 6;
}

/** Scripted RNG. Throws if the engine asks for more randomness than the test expects. */
export function scripted(values: number[] = []): Rng & { remaining: () => number } {
  const queue = [...values];
  return {
    next() {
      const v = queue.shift();
      if (v === undefined) throw new Error("Scripted RNG exhausted: unexpected randomness");
      return v;
    },
    remaining: () => queue.length,
  };
}

export function game(opts: Partial<CreateGameOptions> = {}): GameState {
  return createGame({ playerCount: 4, ...opts });
}

/** Relative position a colour needs to stand on an absolute square. */
export function rel(color: Color, square: number): number {
  return (square - START_SQUARE[color] + TRACK_LENGTH) % TRACK_LENGTH;
}

/** Sets token positions for a seat. `undefined` leaves a token unchanged. */
export function place(s: GameState, seat: number, positions: (number | undefined)[]): GameState {
  positions.forEach((pos, i) => {
    if (pos !== undefined) s.players[seat]!.tokens[i] = { pos, split: null, drifting: false };
  });
  return s;
}

export function split(s: GameState, seat: number, token: number, origin: number, markers: [number, number]): GameState {
  s.players[seat]!.tokens[token] = { pos: origin, split: markers, drifting: false };
  return s;
}

export function drift(s: GameState, seat: number, token: number): GameState {
  s.players[seat]!.tokens[token]!.drifting = true;
  return s;
}

/** Puts the game into the act phase for `seat` with a given roll. */
export function withRoll(s: GameState, roll: number, seat = s.current): GameState {
  s.current = seat;
  s.phase = "act";
  s.roll = roll;
  s.bonus = false;
  s.flags = freshFlags();
  return s;
}

export function apply(s: GameState, action: Action, rngValues: number[] = []) {
  const rng = scripted(rngValues);
  const result = applyAction(s, action, rng);
  if (rng.remaining() !== 0) throw new Error(`Engine used less randomness than scripted (${rng.remaining()} left)`);
  return result;
}

export function types(actions: Action[]): string[] {
  return actions.map((a) => a.type);
}
