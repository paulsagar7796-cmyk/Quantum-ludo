import {
  absSquare,
  hasOpposingPresence,
  isDrifting,
  isNode,
  isOnTrack,
  isSafe,
  markersAt,
  playerAt,
  realTokensAt,
} from "./board";
import { HOME_COLUMN_START, HOME_POS, YARD } from "./constants";
import { cloneState, freshFlags } from "./create";
import { currentPlayer, ghostTarget, isLegal, moveTarget, superposeTargets } from "./legal";
import { flipCoin, rollDie } from "./rng";
import { buildResult } from "./scoring";
import type {
  Action,
  ApplyResult,
  CollapseCause,
  GameEvent,
  GameState,
  MarkerIndex,
  Mechanic,
  PlayerState,
  Rng,
  TokenRef,
} from "./types";

export interface ApplyOptions {
  /** Skip the legality check. Only for callers that pick from `legalActions` (bots, sims). */
  trusted?: boolean;
}

/**
 * Applies one action and returns a new state plus the events it caused.
 * The input state is never mutated. All randomness comes from `rng`.
 */
export function applyAction(state: GameState, action: Action, rng: Rng, opts: ApplyOptions = {}): ApplyResult {
  if (!opts.trusted && !isLegal(state, action)) {
    throw new Error(`Illegal action ${JSON.stringify(action)} in phase ${state.phase}`);
  }
  const ctx: Ctx = { s: cloneState(state), events: [], rng };
  run(ctx, action);
  return { state: ctx.s, events: ctx.events };
}

interface Ctx {
  s: GameState;
  events: GameEvent[];
  rng: Rng;
}

function over(ctx: Ctx): boolean {
  return ctx.s.phase === "over";
}

function run(ctx: Ctx, action: Action): void {
  const { s } = ctx;
  const player = currentPlayer(s);

  switch (action.type) {
    case "roll":
      return doRoll(ctx, player);
    case "collapse":
      return collapse(ctx, player, splitTokenIndex(player), action.marker, "owner");
    case "hold": {
      player.splitHolds++;
      s.flags.held = true;
      const token = splitTokenIndex(player);
      const turnsLeft = s.config.rules.splitMaxTurns - 1 - player.splitHolds;
      ctx.events.push({ type: "held", seat: player.seat, token, turnsLeft });
      return;
    }
    case "decouple":
      player.link = null;
      ctx.events.push({ type: "decoupled", seat: player.seat, reason: "choice" });
      return;
    case "entangle":
      spend(ctx, player, "entangle");
      player.link = [action.tokens[0], action.tokens[1]];
      s.flags.entangled = true;
      ctx.events.push({ type: "entangled", seat: player.seat, tokens: player.link });
      return;
    case "observe":
      return doObserve(ctx, player, action.target, action.marker);
    case "move": {
      const to = moveTarget(s, action.token, s.roll!)!;
      moveWithLink(ctx, player, action.token, to, "move");
      return endRollAction(ctx);
    }
    case "ghost": {
      const to = ghostTarget(s, action.token, s.roll!)!;
      spend(ctx, player, "ghost");
      player.tokens[action.token]!.drifting = true;
      moveWithLink(ctx, player, action.token, to, "ghost");
      return endRollAction(ctx);
    }
    case "superpose": {
      const markers = superposeTargets(s, action.token, s.roll!)!;
      spend(ctx, player, "superpose");
      player.tokens[action.token]!.split = markers;
      player.splitHolds = 0;
      ctx.events.push({ type: "superposed", seat: player.seat, token: action.token, markers: [...markers] });
      return endRollAction(ctx);
    }
    case "pass":
      ctx.events.push({ type: "passed", seat: player.seat });
      return endRollAction(ctx);
  }
}

function doRoll(ctx: Ctx, player: PlayerState): void {
  const { s } = ctx;
  const value = rollDie(ctx.rng);
  ctx.events.push({ type: "rolled", seat: player.seat, value });
  if (value === 6) {
    s.sixStreak++;
    if (s.sixStreak >= s.config.rules.maxConsecutiveSixes) {
      ctx.events.push({ type: "forfeit", seat: player.seat });
      return endTurn(ctx);
    }
  }
  s.roll = value;
  s.phase = "act";
  s.flags = freshFlags();
}

function splitTokenIndex(player: PlayerState): number {
  return player.tokens.findIndex((t) => t.split !== null);
}

function spend(ctx: Ctx, player: PlayerState, mechanic: Mechanic): void {
  player.q -= 1;
  ctx.events.push({ type: "qSpent", seat: player.seat, mechanic });
}

function gainQ(ctx: Ctx, player: PlayerState, reason: "node" | "captured", square?: number): boolean {
  if (player.q >= ctx.s.config.rules.maxQ) return false;
  player.q += 1;
  ctx.events.push({
    type: "qGained",
    seat: player.seat,
    amount: 1,
    reason,
    ...(square !== undefined ? { square } : {}),
  });
  return true;
}

function doObserve(ctx: Ctx, player: PlayerState, target: TokenRef, chosen: MarkerIndex | undefined): void {
  const { s } = ctx;
  const mode = s.config.observationMode;
  spend(ctx, player, "observe");
  s.flags.observed = true;
  ctx.events.push({ type: "observed", seat: player.seat, target, mode });
  const marker: MarkerIndex = mode === "choice" ? chosen! : flipCoin(ctx.rng) ? 0 : 1;
  // Force is a free action in both modes: the observer still has their roll to use.
  collapse(ctx, playerAt(s, target.seat), target.token, marker, "observe");
}

/** Makes a superposed token real on one of its markers. Collapses never capture and never harvest Nodes. */
function collapse(ctx: Ctx, owner: PlayerState, token: number, marker: MarkerIndex, cause: CollapseCause): void {
  const t = owner.tokens[token]!;
  const to = t.split![marker];
  t.split = null;
  t.pos = to;
  ctx.events.push({ type: "collapsed", seat: owner.seat, token, to, cause });
  if (to === HOME_POS) reachHome(ctx, owner, token);
}

/** Moves a token, then gives its entangled partner the free half-roll move. */
function moveWithLink(ctx: Ctx, player: PlayerState, token: number, to: number, via: "move" | "ghost"): void {
  const { s } = ctx;
  moveToken(ctx, player, token, to, via);
  if (over(ctx) || !player.link || !player.link.includes(token)) return;

  const partner = player.link[0] === token ? player.link[1] : player.link[0];
  const half = Math.floor(s.roll! / 2);
  if (half >= 1) {
    const pto = moveTarget(s, partner, half);
    if (pto !== null) moveToken(ctx, player, partner, pto, "link");
  }
  if (over(ctx)) return;
  const link = player.link;
  if (link && link.some((i) => player.tokens[i]!.pos >= HOME_COLUMN_START)) {
    player.link = null;
    ctx.events.push({ type: "decoupled", seat: player.seat, reason: "homeColumn" });
  }
}

function moveToken(ctx: Ctx, player: PlayerState, token: number, to: number, via: "move" | "ghost" | "link"): void {
  const t = player.tokens[token]!;
  const from = t.pos;
  t.pos = to;
  if (from === YARD) {
    ctx.events.push({ type: "entered", seat: player.seat, token });
    return; // Entering lands on your own (safe) start square and never harvests.
  }
  ctx.events.push({ type: "moved", seat: player.seat, token, from, to, via });
  if (to === HOME_POS) return reachHome(ctx, player, token);
  const sq = absSquare(player.color, to);
  if (sq !== null) resolveLanding(ctx, player, sq, t.drifting);
}

/**
 * Captures, marker hits and Node payouts for a real token landing on a shared square.
 * A drifting token never captures or hits; drifting victims are immune.
 */
function resolveLanding(ctx: Ctx, player: PlayerState, sq: number, drifting: boolean): void {
  const { s } = ctx;
  if (!isSafe(sq)) {
    if (drifting) return;
    for (const ref of realTokensAt(s, sq)) {
      if (ref.seat !== player.seat && !isDrifting(s, ref)) capture(ctx, player, ref, sq, false);
    }
    for (const m of markersAt(s, sq)) {
      if (m.seat === player.seat) continue;
      const victim = playerAt(s, m.seat);
      const ref = { seat: m.seat, token: m.token };
      // Heads: the token really was on the marker that got hit.
      const success = flipCoin(ctx.rng);
      ctx.events.push({ type: "hit", seat: player.seat, victim: ref, marker: m.marker, success });
      if (success) {
        capture(ctx, player, ref, sq, true);
      } else {
        collapse(ctx, victim, m.token, m.marker === 0 ? 1 : 0, "hit");
        if (over(ctx)) return;
      }
    }
    return;
  }
  if (isNode(sq) && s.nodeHarvestRound[sq] !== s.round) {
    if (gainQ(ctx, player, "node", sq)) s.nodeHarvestRound[sq] = s.round;
  }
}

function capture(ctx: Ctx, attacker: PlayerState, ref: TokenRef, sq: number, wasSplit: boolean): void {
  const pts = ctx.s.config.rules.points;
  const victim = playerAt(ctx.s, ref.seat);
  const t = victim.tokens[ref.token]!;
  t.pos = YARD;
  t.split = null;
  attacker.score.captures += wasSplit ? pts.captureSplit : pts.capture;
  victim.score.captured += pts.captured;
  ctx.events.push({ type: "captured", seat: attacker.seat, victim: ref, square: sq, wasSplit });
  gainQ(ctx, victim, "captured");

  if (victim.link && victim.link.includes(ref.token)) {
    const partner = victim.link[0] === ref.token ? victim.link[1] : victim.link[0];
    victim.link = null;
    ctx.events.push({ type: "decoupled", seat: victim.seat, reason: "capture" });
    knockback(ctx, victim, partner);
  }
}

/** Partner of a captured entangled token steps back. Retreats never capture or harvest. Drifting tokens are immune. */
function knockback(ctx: Ctx, player: PlayerState, token: number): void {
  const t = player.tokens[token]!;
  if (!isOnTrack(t.pos) || t.split || t.drifting) return;
  const from = t.pos;
  let to = Math.max(0, from - ctx.s.config.rules.knockback);
  while (to > 0 && hasOpposingPresence(ctx.s, absSquare(player.color, to)!, player.seat)) to--;
  t.pos = to;
  ctx.events.push({ type: "knockback", seat: player.seat, token, from, to });
}

function reachHome(ctx: Ctx, player: PlayerState, token: number): void {
  const { s } = ctx;
  player.score.home += s.config.rules.points.home;
  ctx.events.push({ type: "tokenHome", seat: player.seat, token });
  if (player.finished || !player.tokens.every((t) => t.pos === HOME_POS && !t.split)) return;

  player.finished = true;
  s.finishOrder.push(player.seat);
  ctx.events.push({ type: "playerFinished", seat: player.seat, place: s.finishOrder.length });
  const remaining = s.players.filter((p) => !p.finished).length;
  if (s.config.endCondition === "firstFinisher" || remaining <= 1) endGame(ctx, "finish");
}

/** After a roll-consuming action: bonus roll on a 6, otherwise next player. */
function endRollAction(ctx: Ctx): void {
  const { s } = ctx;
  if (over(ctx)) return;
  const player = currentPlayer(s);
  if (s.roll === 6 && !player.finished) {
    s.phase = "upkeep";
    s.bonus = true;
    s.roll = null;
    ctx.events.push({ type: "turnStart", seat: player.seat, round: s.round, bonus: true });
    return;
  }
  endTurn(ctx);
}

function endTurn(ctx: Ctx): void {
  const { s } = ctx;
  const n = s.players.length;
  let next = s.current;
  do {
    next = (next + 1) % n;
    if (next === 0) s.round++;
  } while (s.players[next]!.finished && next !== s.current);

  if (s.round > s.config.rules.roundCap) {
    s.round = s.config.rules.roundCap;
    return endGame(ctx, "roundCap");
  }
  s.current = next;
  s.phase = "upkeep";
  s.roll = null;
  s.bonus = false;
  s.sixStreak = 0;
  s.turn++;
  s.flags = freshFlags();
  const player = s.players[next]!;
  ctx.events.push({ type: "turnStart", seat: player.seat, round: s.round, bonus: false });
  // Ghost drift lasts until the owner's next turn.
  player.tokens.forEach((t, i) => {
    if (!t.drifting) return;
    t.drifting = false;
    ctx.events.push({ type: "solidified", seat: player.seat, token: i });
  });
}

function endGame(ctx: Ctx, reason: "finish" | "roundCap"): void {
  const { s } = ctx;
  s.phase = "over";
  s.roll = null;
  s.result = buildResult(s, reason);
  ctx.events.push({ type: "gameOver", result: s.result });
}
