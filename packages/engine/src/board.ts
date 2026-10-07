import { HOME_POS, LAST_TRACK_POS, NODE_SQUARES, SAFE_SQUARES, START_SQUARE, TRACK_LENGTH, YARD } from "./constants";
import type { Color, GameState, MarkerIndex, PlayerState, TokenRef } from "./types";

/** Absolute loop square for a relative position, or null when not on the shared track. */
export function absSquare(color: Color, pos: number): number | null {
  if (pos < 0 || pos > LAST_TRACK_POS) return null;
  return (START_SQUARE[color] + pos) % TRACK_LENGTH;
}

export function isSafe(square: number): boolean {
  return SAFE_SQUARES.has(square);
}

export function isNode(square: number): boolean {
  return NODE_SQUARES.has(square);
}

export function isOnTrack(pos: number): boolean {
  return pos >= 0 && pos <= LAST_TRACK_POS;
}

export function isReal(player: PlayerState, token: number): boolean {
  return player.tokens[token]!.split === null;
}

export function playerAt(state: GameState, seat: number): PlayerState {
  const p = state.players.find((pl) => pl.seat === seat);
  if (!p) throw new Error(`No player at seat ${seat}`);
  return p;
}

/** Real (non-split) tokens on a given absolute square. */
export function realTokensAt(state: GameState, square: number): TokenRef[] {
  const out: TokenRef[] = [];
  for (const p of state.players) {
    p.tokens.forEach((t, i) => {
      if (t.split === null && absSquare(p.color, t.pos) === square) out.push({ seat: p.seat, token: i });
    });
  }
  return out;
}

export interface MarkerRef extends TokenRef {
  marker: MarkerIndex;
}

/** Superposition markers on a given absolute square. */
export function markersAt(state: GameState, square: number): MarkerRef[] {
  const out: MarkerRef[] = [];
  for (const p of state.players) {
    p.tokens.forEach((t, i) => {
      if (t.split === null) return;
      t.split.forEach((m, mi) => {
        if (absSquare(p.color, m) === square) out.push({ seat: p.seat, token: i, marker: mi as MarkerIndex });
      });
    });
  }
  return out;
}

export function isDrifting(state: GameState, ref: TokenRef): boolean {
  return playerAt(state, ref.seat).tokens[ref.token]!.drifting;
}

/** Blockade: 2+ real, non-drifting tokens of one colour on a non-safe square. */
export function blockadeOwner(state: GameState, square: number): number | null {
  if (isSafe(square)) return null;
  const counts = new Map<number, number>();
  for (const ref of realTokensAt(state, square)) {
    if (!isDrifting(state, ref)) counts.set(ref.seat, (counts.get(ref.seat) ?? 0) + 1);
  }
  for (const [seat, n] of counts) if (n >= 2) return seat;
  return null;
}

export function isOpposingBlockade(state: GameState, square: number, seat: number): boolean {
  const owner = blockadeOwner(state, square);
  return owner !== null && owner !== seat;
}

/** True when a non-safe square holds any opposing real token or marker. */
export function hasOpposingPresence(state: GameState, square: number, seat: number): boolean {
  if (isSafe(square)) return false;
  return (
    realTokensAt(state, square).some((r) => r.seat !== seat) || markersAt(state, square).some((m) => m.seat !== seat)
  );
}

/** True when no opposing blockade sits on the path from `from` to `to` (inclusive of `to`). */
export function pathClear(state: GameState, seat: number, from: number, to: number): boolean {
  const player = playerAt(state, seat);
  const start = from === YARD ? 0 : from + 1;
  for (let p = start; p <= Math.min(to, LAST_TRACK_POS); p++) {
    if (isOpposingBlockade(state, absSquare(player.color, p)!, seat)) return false;
  }
  return true;
}

/** Destination of a normal move for `roll`, or null when out of range. Does not check blockades. */
export function destination(pos: number, roll: number): number | null {
  if (pos === YARD) return null;
  const to = pos + roll;
  return to > HOME_POS ? null : to;
}

/** Squares still to travel; a yard token also needs the step onto its start square. */
export function distanceToHome(pos: number, split: [number, number] | null): number {
  if (!split && pos === YARD) return HOME_POS + 1;
  return HOME_POS - tokenProgress(pos, split);
}

/** Progress value used for scoring; split tokens count at their less-advanced marker. */
export function tokenProgress(pos: number, split: [number, number] | null): number {
  if (split) return Math.min(split[0], split[1]);
  return Math.max(pos, 0);
}
