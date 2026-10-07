import { legalActions, type Action, type GameState } from "@qludo/engine";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { GameController, SeatKind } from "../game/controller";
import { COLOR_NAME } from "../game/labels";
import { seatName, type MatchConfig } from "../game/match";
import { usePresentation } from "../game/usePresentation";
import type { Link } from "./peer";
import { parse, type HostMessage } from "./protocol";

export interface GuestGame extends Omit<GameController, "state" | "legal"> {
  /** Null until the host starts the game. */
  state: GameState | null;
  legal: Action[];
  /** Null until the host's welcome arrives. */
  match: MatchConfig | null;
  seat: number;
  connected: boolean;
}

/**
 * A guest mirrors the host's game. It never runs the engine's random parts: it shows the state
 * the host sends and sends its own chosen actions back for the host to check and apply.
 */
export function useGuestGame(link: Link, seat: number): GuestGame {
  const [match, setMatch] = useState<MatchConfig | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [connected, setConnected] = useState(link.isOpen());
  /** An action is on its way to the host: don't send another until the host answers. */
  const [pending, setPending] = useState(false);

  const localSeats = useMemo(() => new Set([seat]), [seat]);
  const name = useCallback(
    (s: number) => {
      if (s === seat) return "You";
      if (!match) return COLOR_NAME[state?.players[s]?.color ?? "red"];
      const n = seatName(match, s);
      // The host calls themselves "You"; on this device they are the host.
      return n === "You" ? `${COLOR_NAME[state?.players[s]?.color ?? "red"]} (host)` : n;
    },
    [match, seat, state],
  );
  const seatKind = useCallback(
    (s: number): SeatKind => (s === seat ? "local" : match?.seats[s]?.kind === "bot" ? "bot" : "remote"),
    [match, seat],
  );

  const view = usePresentation({
    name,
    localSeats,
    animate: match?.botSpeed !== "instant",
  });
  const { ingest, reset } = view;

  useEffect(() => {
    const onMessage = (data: string) => {
      const msg = parse<HostMessage>(data);
      if (!msg) return;
      switch (msg.t) {
        case "welcome":
          setMatch(msg.match);
          setState(msg.state);
          setPending(false);
          break;
        case "match":
          setMatch(msg.match);
          break;
        case "start":
          reset();
          setState(msg.state);
          setPending(false);
          break;
        case "sync":
          setState(msg.state);
          ingest(msg.events);
          setPending(false);
          break;
        case "bye":
          setConnected(false);
          break;
      }
    };
    const unsubscribe = link.subscribe(onMessage);
    const unClose = link.onClose(() => setConnected(false));
    return () => {
      unsubscribe();
      unClose();
    };
  }, [link, ingest, reset]);

  const dispatch = useCallback(
    (action: Action) => {
      if (pending || !connected) return;
      setPending(true);
      link.send(JSON.stringify({ t: "action", action }));
    },
    [link, pending, connected],
  );

  const legal = useMemo(() => (state ? legalActions(state) : []), [state]);
  const offline = useMemo(() => new Set<number>(), []);
  return {
    log: view.log,
    lastEvents: view.lastEvents,
    lastRoll: view.lastRoll,
    rolling: view.rolling,
    state,
    legal,
    match,
    seat,
    connected,
    isHumanTurn: !!state && state.phase !== "over" && state.current === seat && !pending && connected,
    localSeats,
    seatKind,
    offline,
    dispatch,
    name,
    notice: connected ? null : "Lost the connection to the host. Ask the host for a new invite to rejoin.",
  };
}
