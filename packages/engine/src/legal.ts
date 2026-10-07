import { absSquare, destination, hasOpposingPresence, isOnTrack, pathClear } from "./board";
import { ENTRY_ROLL, HOME_POS, LAST_TRACK_POS, YARD } from "./constants";
import type { Action, GameState, MarkerIndex, PlayerState } from "./types";

export function currentPlayer(state: GameState): PlayerState {
  return state.players[state.current]!;
}

/** True when the current player must collapse (or hold) their superposed token before rolling. */
export function mustCollapse(state: GameState): boolean {
  return (
    state.phase === "upkeep" &&
    !state.bonus &&
    !state.flags.held &&
    currentPlayer(state).tokens.some((t) => t.split !== null)
  );
}

/** True when the current player may keep their superposition open for another round instead of collapsing. */
export function canHold(state: GameState): boolean {
  return mustCollapse(state) && currentPlayer(state).splitHolds < state.config.rules.splitMaxTurns - 1;
}

/**
 * Destination of a normal move, or null if illegal.
 * A drifting token moves like a ghost: it ignores blockades but must stay on the shared track.
 */
export function moveTarget(state: GameState, token: number, roll: number): number | null {
  const player = currentPlayer(state);
  const t = player.tokens[token]!;
  if (t.split) return null;
  if (t.pos === YARD) return roll === ENTRY_ROLL ? 0 : null;
  if (t.pos === HOME_POS) return null;
  const to = destination(t.pos, roll);
  if (to === null) return null;
  if (t.drifting) return to <= LAST_TRACK_POS ? to : null;
  return pathClear(state, player.seat, t.pos, to) ? to : null;
}

/** Destination of a Ghost move: a real token on the shared track that stays on the shared track. */
export function ghostTarget(state: GameState, token: number, roll: number): number | null {
  const t = currentPlayer(state).tokens[token]!;
  if (t.split || t.drifting || !isOnTrack(t.pos)) return null;
  const to = t.pos + roll;
  return to <= LAST_TRACK_POS ? to : null;
}

/** Marker positions for a superposition, or null if illegal. */
export function superposeTargets(state: GameState, token: number, roll: number): [number, number] | null {
  const player = currentPlayer(state);
  const t = player.tokens[token]!;
  if (t.split || t.drifting || !isOnTrack(t.pos)) return null;
  if (player.tokens.some((o) => o.split !== null)) return null;
  if (player.link && player.link.includes(token)) return null;
  const markers: [number, number] = [t.pos + roll, t.pos + (7 - roll)];
  for (const m of markers) {
    if (m > HOME_POS) return null;
    if (!pathClear(state, player.seat, t.pos, m)) return null;
    const sq = absSquare(player.color, m);
    if (sq !== null && hasOpposingPresence(state, sq, player.seat)) return null;
  }
  return markers;
}

function canEntangle(player: PlayerState, token: number): boolean {
  const t = player.tokens[token]!;
  return t.split === null && isOnTrack(t.pos);
}

/** Actions that use up the current roll. Link and Force are free actions taken before you move. */
const ROLL_CONSUMING = new Set<Action["type"]>(["move", "ghost", "superpose", "pass"]);

export function consumesRoll(action: Action): boolean {
  return ROLL_CONSUMING.has(action.type);
}

/** Every action the current player may take. The single source of truth for UI and bots. */
export function legalActions(state: GameState): Action[] {
  if (state.phase === "over") return [];
  const player = currentPlayer(state);

  if (state.phase === "upkeep") {
    if (mustCollapse(state)) {
      const out: Action[] = [{ type: "collapse", marker: 0 }, { type: "collapse", marker: 1 }];
      if (canHold(state)) out.push({ type: "hold" });
      return out;
    }
    const out: Action[] = [{ type: "roll" }];
    if (!state.bonus && player.link) out.push({ type: "decouple" });
    return out;
  }

  const roll = state.roll!;
  const out: Action[] = [];
  let anyMove = false;

  player.tokens.forEach((_, i) => {
    if (moveTarget(state, i, roll) !== null) {
      out.push({ type: "move", token: i });
      anyMove = true;
    }
  });

  if (player.q >= 1) {
    player.tokens.forEach((_, i) => {
      if (ghostTarget(state, i, roll) !== null) out.push({ type: "ghost", token: i });
    });
    player.tokens.forEach((_, i) => {
      if (superposeTargets(state, i, roll) !== null) out.push({ type: "superpose", token: i });
    });
    if (!player.link && !state.flags.entangled) {
      for (let a = 0; a < player.tokens.length; a++) {
        for (let b = a + 1; b < player.tokens.length; b++) {
          if (canEntangle(player, a) && canEntangle(player, b)) out.push({ type: "entangle", tokens: [a, b] });
        }
      }
    }
    if (!state.flags.observed) {
      for (const opp of state.players) {
        if (opp.seat === player.seat) continue;
        opp.tokens.forEach((t, i) => {
          if (!t.split) return;
          const target = { seat: opp.seat, token: i };
          if (state.config.observationMode === "coin") out.push({ type: "observe", target });
          else for (const marker of [0, 1] as MarkerIndex[]) out.push({ type: "observe", target, marker });
        });
      }
    }
  }

  // You must make a normal move when one exists. Quantum actions cost Q, so they are never forced.
  if (!anyMove) out.push({ type: "pass" });
  return out;
}

/** Canonical string for an action, used to compare actions arriving from UI, bots or the network. */
export function actionKey(a: Action): string {
  switch (a.type) {
    case "collapse":
      return `collapse:${a.marker}`;
    case "move":
    case "ghost":
    case "superpose":
      return `${a.type}:${a.token}`;
    case "entangle":
      return `entangle:${Math.min(...a.tokens)},${Math.max(...a.tokens)}`;
    case "observe":
      return `observe:${a.target.seat}.${a.target.token}:${a.marker ?? ""}`;
    default:
      return a.type;
  }
}

export function isLegal(state: GameState, action: Action): boolean {
  const key = actionKey(action);
  return legalActions(state).some((a) => actionKey(a) === key);
}
