import type { Action, GameState } from "@qludo/engine";
import type { Presentation } from "./usePresentation";

/** Who controls a seat, from this device's point of view. */
export type SeatKind = "local" | "bot" | "remote";

/**
 * What the game screen needs, whatever runs the game: this device (local or host),
 * or another device (guest).
 */
export interface GameController extends Omit<Presentation, "ingest" | "reset"> {
  state: GameState;
  legal: Action[];
  /** The current seat is played on this device and may act now. */
  isHumanTurn: boolean;
  localSeats: ReadonlySet<number>;
  seatKind: (seat: number) => SeatKind;
  /** Remote seats whose player is not connected right now. */
  offline: ReadonlySet<number>;
  dispatch: (action: Action) => void;
  name: (seat: number) => string;
  /** A banner for connection problems and similar. */
  notice: string | null;
}
