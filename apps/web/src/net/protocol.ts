import type { Action, GameEvent, GameState } from "@qludo/engine";
import type { MatchConfig } from "../game/match";

/** Carried in the host's invite code. */
export interface OfferPayload {
  k: "offer";
  sdp: string;
  seat: number;
  hostName: string;
}

/** Carried in the guest's reply code. */
export interface AnswerPayload {
  k: "answer";
  sdp: string;
  seat: number;
  name: string;
}

export interface LastRoll {
  seat: number;
  value: number;
  n: number;
}

/** Host → guest. The host is the authority: guests only ever display what it sends. */
export type HostMessage =
  | { t: "welcome"; seat: number; match: MatchConfig; state: GameState | null; lastRoll: LastRoll | null }
  | { t: "match"; match: MatchConfig }
  | { t: "start"; state: GameState }
  | { t: "sync"; state: GameState; events: GameEvent[] }
  | { t: "bye"; reason: string };

/** Guest → host. */
export type GuestMessage = { t: "action"; action: Action };

export function send(channel: RTCDataChannel, msg: HostMessage | GuestMessage): void {
  if (channel.readyState === "open") channel.send(JSON.stringify(msg));
}

export function parse<T extends HostMessage | GuestMessage>(data: unknown): T | null {
  if (typeof data !== "string") return null;
  try {
    const msg = JSON.parse(data) as { t?: unknown };
    return typeof msg?.t === "string" ? (msg as T) : null;
  } catch {
    return null;
  }
}
