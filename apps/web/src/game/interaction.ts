import {
  ghostTarget,
  moveTarget,
  superposeTargets,
  type Action,
  type GameState,
  type MarkerIndex,
  type TokenRef,
} from "@qludo/engine";

/** What the current player can do with one of their tokens this roll. */
export interface TokenChoice {
  token: number;
  move: number | null;
  split: [number, number] | null;
  ghost: number | null;
}

export function tokenChoices(state: GameState, legal: Action[]): Map<number, TokenChoice> {
  const out = new Map<number, TokenChoice>();
  const roll = state.roll;
  if (state.phase !== "act" || roll === null) return out;
  const get = (token: number) => {
    let c = out.get(token);
    if (!c) out.set(token, (c = { token, move: null, split: null, ghost: null }));
    return c;
  };
  for (const a of legal) {
    if (a.type === "move") get(a.token).move = moveTarget(state, a.token, roll);
    if (a.type === "superpose") get(a.token).split = superposeTargets(state, a.token, roll);
    if (a.type === "ghost") get(a.token).ghost = ghostTarget(state, a.token, roll);
  }
  return out;
}

/** Tokens that can take part in a Link this roll. */
export function linkableTokens(legal: Action[]): Set<number> {
  const s = new Set<number>();
  for (const a of legal) if (a.type === "entangle") a.tokens.forEach((t) => s.add(t));
  return s;
}

export function canLink(legal: Action[], a: number, b: number): boolean {
  return legal.some((x) => x.type === "entangle" && x.tokens.includes(a) && x.tokens.includes(b));
}

export interface ForceOption {
  target: TokenRef;
  marker?: MarkerIndex;
}

export function forceOptions(legal: Action[]): ForceOption[] {
  return legal.flatMap((a) =>
    a.type === "observe" ? [{ target: a.target, ...(a.marker !== undefined ? { marker: a.marker } : {}) }] : [],
  );
}

export function has(legal: Action[], type: Action["type"]): boolean {
  return legal.some((a) => a.type === type);
}
