import type { GameEvent, GameState } from "@qludo/engine";
import { HOME_POS } from "@qludo/engine";
import { TRACK, centre, pointFor, type Point } from "./layout";
import { HOP_MS } from "./useWalk";

export type EffectKind = "capture" | "split" | "ghost" | "force" | "node" | "home" | "miss";

export interface BoardEffect {
  id: string;
  kind: EffectKind;
  point: Point;
  /** Wait for the moving token to hop there first. */
  delayMs: number;
}

/** Visual effects for one action's events. `batch` makes ids unique so animations restart. */
export function effectsFor(events: GameEvent[], state: GameState, batch: number): BoardEffect[] {
  const out: BoardEffect[] = [];
  const color = (seat: number) => state.players[seat]!.color;
  let walkMs = 0; // time the last move takes to hop to its destination
  let landing: Point | null = null;

  events.forEach((e, i) => {
    const add = (kind: EffectKind, point: Point, delayMs = walkMs) =>
      out.push({ id: `${batch}-${i}-${out.length}`, kind, point, delayMs });
    switch (e.type) {
      case "moved": {
        const steps = e.to - e.from;
        walkMs = steps >= 2 && steps <= 12 ? steps * HOP_MS : 0;
        landing = pointFor(color(e.seat), e.to, e.token);
        if (e.via === "ghost") add("ghost", landing);
        break;
      }
      case "captured":
        add("capture", centre(TRACK[e.square]!));
        break;
      case "hit":
        if (!e.success && landing) add("miss", landing);
        break;
      case "superposed":
        for (const m of e.markers) add("split", pointFor(color(e.seat), m, e.token), 0);
        break;
      case "collapsed":
        if (e.cause === "observe") add("force", pointFor(color(e.seat), e.to, e.token), 0);
        break;
      case "qGained":
        if (e.reason === "node" && e.square !== undefined) add("node", centre(TRACK[e.square]!));
        break;
      case "tokenHome":
        add("home", pointFor(color(e.seat), HOME_POS, e.token));
        break;
      default:
        break;
    }
  });
  return out;
}
