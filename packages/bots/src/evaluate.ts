import {
  HOME_POS,
  LAST_TRACK_POS,
  TRACK_LENGTH,
  YARD,
  absSquare,
  isOnTrack,
  isSafe,
  type GameState,
  type PlayerState,
} from "@qludo/engine";

/** How much a personality cares about each feature of a position. */
export interface Weights {
  /** Per square of progress on tokens. */
  progress: number;
  /** Per token out of the yard. */
  enter: number;
  /** Per token home (on top of the points it scores). */
  home: number;
  /** Per in-game point (home, captures, being captured). */
  points: number;
  /** Multiplier on expected loss from being hit next turn. */
  danger: number;
  /** Per token sitting on a safe square. */
  safe: number;
  /** Value of holding Q (first charge; later ones are worth a bit less). */
  q: number;
  /** Value of having an active entanglement. */
  link: number;
  /** Value of having a token in superposition. */
  split: number;
  /** Weight on the average opponent's standing (subtracted). */
  opponent: number;
  /** Per opponent token our tokens can reach with one roll. */
  attack: number;
}

const REENTRY_COST = 8;

/** Distance from an attacker to a square along the attacker's own path, if reachable with one roll. */
function reach(attacker: PlayerState, pos: number, square: number): number | null {
  const from = absSquare(attacker.color, pos);
  if (from === null) return null;
  const d = (square - from + TRACK_LENGTH) % TRACK_LENGTH;
  return d >= 1 && d <= 6 && pos + d <= LAST_TRACK_POS ? d : null;
}

/** Rough chance that some opponent can land on `square` on their next roll. */
function threat(state: GameState, seat: number, square: number): number {
  if (isSafe(square)) return 0;
  const distances = new Set<number>();
  for (const opp of state.players) {
    if (opp.seat === seat) continue;
    for (const t of opp.tokens) {
      if (t.split || !isOnTrack(t.pos)) continue;
      const d = reach(opp, t.pos, square);
      if (d !== null) distances.add(d);
    }
  }
  return 1 - Math.pow(5 / 6, distances.size);
}

function qValue(q: number): number {
  let v = 0;
  for (let i = 0; i < q; i++) v += 1 - 0.15 * i;
  return v;
}

function points(p: PlayerState): number {
  return p.score.home + p.score.captures + p.score.captured;
}

/** A player's standing from an opponent's point of view: progress plus points. */
function standing(p: PlayerState): number {
  let s = points(p);
  for (const t of p.tokens) {
    if (t.split) s += (t.split[0] + t.split[1]) / 2;
    else if (t.pos !== YARD) s += t.pos + 4;
  }
  return s;
}

export function evaluate(state: GameState, seat: number, w: Weights): number {
  const me = state.players[seat]!;

  if (state.result) {
    const scores = state.result.scores;
    const best = Math.max(...scores.filter((s) => s.seat !== seat).map((s) => s.total));
    return (state.result.ranking[0] === seat ? 1000 : 0) + 5 * (scores[seat]!.total - best);
  }

  let v = w.points * points(me) + w.q * qValue(me.q);
  if (me.link) v += w.link;

  for (const t of me.tokens) {
    if (t.split) {
      const [a, b] = t.split;
      v += w.split + w.enter + w.progress * ((a + b) / 2);
      for (const m of t.split) {
        const sq = absSquare(me.color, m);
        if (sq !== null) v -= w.danger * 0.5 * threat(state, seat, sq) * (m + REENTRY_COST);
      }
      continue;
    }
    if (t.pos === YARD) continue;
    v += w.enter + w.progress * t.pos;
    if (t.pos === HOME_POS) {
      v += w.home;
      continue;
    }
    const sq = absSquare(me.color, t.pos);
    if (sq === null) continue; // home column: safe from everything
    if (isSafe(sq) || t.drifting) {
      v += w.safe; // a drifting Ghost is as safe as a safe square, but cannot attack
      continue;
    }
    let loss = t.pos + REENTRY_COST;
    if (me.link) loss += 6;
    v -= w.danger * threat(state, seat, sq) * loss;

    // Opponent tokens this token could hit with one roll.
    for (const opp of state.players) {
      if (opp.seat === seat) continue;
      for (const ot of opp.tokens) {
        if (ot.split || ot.drifting || !isOnTrack(ot.pos)) continue;
        const osq = absSquare(opp.color, ot.pos)!;
        if (isSafe(osq)) continue;
        if (reach(me, t.pos, osq) !== null) v += w.attack;
      }
    }
  }

  const opponents = state.players.filter((p) => p.seat !== seat);
  const avgOpp = opponents.reduce((sum, p) => sum + standing(p), 0) / opponents.length;
  v -= w.opponent * avgOpp;
  return v;
}
