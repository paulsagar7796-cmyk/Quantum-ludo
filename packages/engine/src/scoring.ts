import { distanceToHome, tokenProgress } from "./board";
import { HOME_POS } from "./constants";
import type { FinalScore, GameResult, GameState, PlayerState } from "./types";

function homeCount(p: PlayerState): number {
  return p.tokens.filter((t) => t.pos === HOME_POS && !t.split).length;
}

function distance(p: PlayerState): number {
  return p.tokens.reduce((sum, t) => sum + distanceToHome(t.pos, t.split), 0);
}

/**
 * Race placement, best first. Players who got all tokens home keep their finishing order.
 * Everyone else: more tokens home, then shorter total distance to home, then lower seat.
 */
export function placement(state: GameState): number[] {
  const rest = state.players
    .filter((p) => !state.finishOrder.includes(p.seat))
    .sort((a, b) => homeCount(b) - homeCount(a) || distance(a) - distance(b) || a.seat - b.seat)
    .map((p) => p.seat);
  return [...state.finishOrder, ...rest];
}

export function finalScores(state: GameState, ranking: number[] = placement(state)): FinalScore[] {
  const rules = state.config.rules;
  return state.players.map((p) => {
    const squares = p.tokens
      .filter((t) => t.pos !== HOME_POS || t.split)
      .reduce((sum, t) => sum + tokenProgress(t.pos, t.split), 0);
    const progress = Math.floor(squares / rules.squaresPerProgressPoint);
    const finishBonus = rules.finishBonus[ranking.indexOf(p.seat)] ?? 0;
    const unspentQ = Math.min(p.q, rules.unspentQCap);
    const total = p.score.home + p.score.captures + p.score.captured + progress + finishBonus + unspentQ;
    return { seat: p.seat, ...p.score, progress, finishBonus, unspentQ, total };
  });
}

export function buildResult(state: GameState, reason: GameResult["reason"]): GameResult {
  const ranking = placement(state);
  return { reason, rounds: state.round, scores: finalScores(state, ranking), ranking };
}
