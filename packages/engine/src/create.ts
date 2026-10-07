import { DEFAULT_RULES, SEAT_COLORS, TOKENS_PER_PLAYER, YARD } from "./constants";
import type { GameConfig, GameState, Rules, TurnFlags } from "./types";

export function freshFlags(): TurnFlags {
  return { entangled: false, observed: false, held: false };
}

export interface CreateGameOptions {
  playerCount: GameConfig["playerCount"];
  observationMode?: GameConfig["observationMode"];
  endCondition?: GameConfig["endCondition"];
  rules?: Partial<Rules>;
}

export function createGame(opts: CreateGameOptions): GameState {
  const rules: Rules = { ...DEFAULT_RULES, ...opts.rules, points: { ...DEFAULT_RULES.points, ...opts.rules?.points } };
  const config: GameConfig = {
    playerCount: opts.playerCount,
    observationMode: opts.observationMode ?? "coin",
    endCondition: opts.endCondition ?? "firstFinisher",
    rules,
  };
  const colors = SEAT_COLORS[opts.playerCount];
  return {
    config,
    players: colors.map((color, seat) => ({
      seat,
      color,
      tokens: Array.from({ length: TOKENS_PER_PLAYER }, () => ({ pos: YARD, split: null, drifting: false })),
      q: rules.startQ,
      link: null,
      splitHolds: 0,
      score: { home: 0, captures: 0, captured: 0 },
      finished: false,
    })),
    current: 0,
    phase: "upkeep",
    roll: null,
    sixStreak: 0,
    bonus: false,
    round: 1,
    turn: 1,
    nodeHarvestRound: {},
    flags: freshFlags(),
    finishOrder: [],
    result: null,
  };
}

/** Deep copy. Hand-written because bots clone states thousands of times per game. */
export function cloneState(s: GameState): GameState {
  return {
    config: s.config,
    players: s.players.map((p) => ({
      seat: p.seat,
      color: p.color,
      tokens: p.tokens.map((t) => ({
        pos: t.pos,
        split: t.split ? [t.split[0], t.split[1]] : null,
        drifting: t.drifting,
      })),
      q: p.q,
      link: p.link ? [p.link[0], p.link[1]] : null,
      splitHolds: p.splitHolds,
      score: { ...p.score },
      finished: p.finished,
    })),
    current: s.current,
    phase: s.phase,
    roll: s.roll,
    sixStreak: s.sixStreak,
    bonus: s.bonus,
    round: s.round,
    turn: s.turn,
    nodeHarvestRound: { ...s.nodeHarvestRound },
    flags: { ...s.flags },
    finishOrder: [...s.finishOrder],
    result: s.result,
  };
}
