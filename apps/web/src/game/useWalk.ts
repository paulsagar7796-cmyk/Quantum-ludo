import { YARD, type GameState } from "@qludo/engine";
import { useEffect, useState } from "react";

/** Time per square when a token walks along the track. Matches the hop sounds. */
export const HOP_MS = 75;

/** A token that is walking: the relative positions it still has to show, in order. */
interface Walk {
  path: number[];
  step: number;
}

const keyOf = (seat: number, token: number) => `${seat}:${token}`;

function walksBetween(prev: GameState, next: GameState): Map<string, Walk> {
  const walks = new Map<string, Walk>();
  for (const p of next.players) {
    p.tokens.forEach((t, i) => {
      const before = prev.players[p.seat]?.tokens[i];
      if (!before || before.split || t.split || before.pos === YARD) return;
      const steps = t.pos - before.pos;
      // Only forward moves along the board animate square by square; captures and knockbacks fly.
      if (steps < 2 || steps > 12) return;
      walks.set(keyOf(p.seat, i), { path: Array.from({ length: steps }, (_, s) => before.pos + s + 1), step: 0 });
    });
  }
  return walks;
}

/**
 * Makes moved tokens hop one square at a time instead of gliding straight to their target.
 * Returns the position to draw for tokens that are mid-walk (others use their real position).
 */
export function useWalk(state: GameState, enabled: boolean): (seat: number, token: number) => number | null {
  const [prev, setPrev] = useState(state);
  const [walks, setWalks] = useState<Map<string, Walk>>(new Map());

  // Start walks during render (not in an effect) so the token never flashes at its destination first.
  if (prev !== state) {
    setPrev(state);
    setWalks(enabled ? walksBetween(prev, state) : new Map());
  }

  useEffect(() => {
    if (walks.size === 0) return;
    const t = setTimeout(() => {
      setWalks((cur) => {
        const next = new Map<string, Walk>();
        for (const [k, w] of cur) if (w.step + 1 < w.path.length) next.set(k, { ...w, step: w.step + 1 });
        return next;
      });
    }, HOP_MS);
    return () => clearTimeout(t);
  }, [walks]);

  return (seat, token) => {
    const w = walks.get(keyOf(seat, token));
    return w ? w.path[w.step]! : null;
  };
}
