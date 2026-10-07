import type { Action } from "@qludo/engine";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { acceptReply, createInvite, whenOpen, type HostInvite } from "./peer";
import { parse, send, type GuestMessage, type HostMessage } from "./protocol";

export type PeerStatus = "idle" | "creating" | "inviting" | "connecting" | "connected" | "offline";

export interface PeerSlot {
  status: PeerStatus;
  /** The invite code to show while inviting. */
  code: string | null;
  error: string | null;
}

export interface HostHandlers {
  /** The guest's reply named them. */
  onName: (seat: number, name: string) => void;
  /** The data channel is open: send them the current match and game. */
  onJoined: (seat: number) => void;
  onAction: (seat: number, action: Action) => void;
}

export interface HostConnections {
  slots: Record<number, PeerSlot>;
  invite: (seat: number) => Promise<void>;
  accept: (seat: number, replyCode: string) => Promise<void>;
  /** Drop a seat's connection (e.g. when it becomes a bot). */
  release: (seat: number) => void;
  broadcast: (msg: HostMessage) => void;
  sendTo: (seat: number, msg: HostMessage) => void;
  /** Remote seats without an open connection. */
  offline: ReadonlySet<number>;
}

const idle: PeerSlot = { status: "idle", code: null, error: null };

/** The host's direct connections, one per remote seat. */
export function useHostConnections(remoteSeats: number[], hostName: string, handlers: HostHandlers): HostConnections {
  const [slots, setSlots] = useState<Record<number, PeerSlot>>({});
  const invites = useRef(new Map<number, HostInvite>());
  const channels = useRef(new Map<number, RTCDataChannel>());
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  const patch = useCallback((seat: number, p: Partial<PeerSlot>) => {
    setSlots((prev) => ({ ...prev, [seat]: { ...(prev[seat] ?? idle), ...p } }));
  }, []);

  const release = useCallback((seat: number) => {
    channels.current.get(seat)?.close();
    invites.current.get(seat)?.pc.close();
    channels.current.delete(seat);
    invites.current.delete(seat);
    setSlots((prev) => ({ ...prev, [seat]: idle }));
  }, []);

  // Close everything when the host leaves.
  useEffect(() => {
    const inv = invites.current;
    return () => {
      for (const i of inv.values()) i.pc.close();
    };
  }, []);

  const invite = useCallback(
    async (seat: number) => {
      invites.current.get(seat)?.pc.close();
      channels.current.delete(seat);
      patch(seat, { status: "creating", code: null, error: null });
      try {
        const inv = await createInvite(seat, hostName);
        invites.current.set(seat, inv);
        patch(seat, { status: "inviting", code: inv.code });
      } catch (e) {
        patch(seat, { status: "idle", error: (e as Error).message });
      }
    },
    [hostName, patch],
  );

  const accept = useCallback(
    async (seat: number, replyCode: string) => {
      const inv = invites.current.get(seat);
      if (!inv) return patch(seat, { error: "Create an invite first." });
      try {
        const name = await acceptReply(inv, replyCode, seat);
        patch(seat, { status: "connecting", error: null });
        handlersRef.current.onName(seat, name);
        const channel = await whenOpen(inv.channel, 30_000);
        channels.current.set(seat, channel);
        channel.addEventListener("message", (e) => {
          const msg = parse<GuestMessage>(e.data);
          if (msg?.t === "action") handlersRef.current.onAction(seat, msg.action);
        });
        const lost = () => {
          if (channels.current.get(seat) !== channel) return;
          channels.current.delete(seat);
          patch(seat, { status: "offline", code: null });
        };
        channel.addEventListener("close", lost);
        // A vanished device shows up as "disconnected" within seconds and may come back;
        // "failed" (about 30 s later) or "closed" is final.
        inv.pc.addEventListener("connectionstatechange", () => {
          const s = inv.pc.connectionState;
          if (s === "failed" || s === "closed") lost();
          else if (s === "disconnected") patch(seat, { status: "offline" });
          else if (s === "connected" && channels.current.get(seat) === channel) patch(seat, { status: "connected" });
        });
        patch(seat, { status: "connected", code: null });
        handlersRef.current.onJoined(seat);
      } catch (e) {
        patch(seat, { status: "inviting", error: (e as Error).message });
      }
    },
    [patch],
  );

  const broadcast = useCallback((msg: HostMessage) => {
    for (const ch of channels.current.values()) send(ch, msg);
  }, []);
  const sendTo = useCallback((seat: number, msg: HostMessage) => {
    const ch = channels.current.get(seat);
    if (ch) send(ch, msg);
  }, []);

  const offline = useMemo(
    () => new Set(remoteSeats.filter((s) => slots[s]?.status !== "connected")),
    [remoteSeats, slots],
  );

  return { slots, invite, accept, release, broadcast, sendTo, offline };
}
