import { PERSONALITIES } from "@qludo/bots";
import { createGame, legalActions, type Action, type GameEvent, type GameState } from "@qludo/engine";
import { replaySteps, type Room } from "@qludo/server";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameController, SeatKind } from "../game/controller";
import { COLOR_NAME } from "../game/labels";
import { ROLL_ANIM_MS, usePresentation } from "../game/usePresentation";
import { api, fetchRoom, supabase, type Seat } from "./api";

export interface OnlineSession extends Seat {
  host: boolean;
}

export interface OnlineRoom extends Omit<GameController, "state"> {
  /** Latest room from the server (null while loading). */
  room: Room | null;
  /** The game as currently shown; it trails `room` while moves are being animated. */
  state: GameState | null;
  seat: number;
  host: boolean;
  /** Seats whose player currently has the room open. */
  present: ReadonlySet<number>;
  start: () => Promise<void>;
  giveToBot: (seat: number) => Promise<void>;
}

interface Frame {
  state: GameState;
  events: GameEvent[];
  /** Pause before showing the next frame. */
  delayMs: number;
  /** Room version this frame belongs to. */
  version: number;
}

const BOT_STEP_MS = 600;

/** Plays an online room: the server decides, this device animates and sends its own moves. */
export function useOnlineRoom(session: OnlineSession): OnlineRoom {
  const { code, seat } = session;
  const [room, setRoom] = useState<Room | null>(null);
  const [shown, setShown] = useState<GameState | null>(null);
  /** Room version of the frame on screen; we're caught up when it equals the room's version. */
  const [shownVersion, setShownVersion] = useState(-1);
  /** True while frames are still being played out. */
  const [playing, setPlaying] = useState(false);
  const frames = useRef<Frame[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [connected, setConnected] = useState(true);
  const [present, setPresent] = useState<ReadonlySet<number>>(new Set());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // What this device has queued so far, so the next update knows where to replay from.
  const queued = useRef<{ version: number; state: GameState | null }>({ version: -1, state: null });

  const match = room?.match;
  const localSeats = useMemo(() => new Set([seat]), [seat]);
  const name = useCallback(
    (s: number) => {
      if (s === seat) return "You";
      const st = match?.seats[s];
      if (st?.kind === "bot") return PERSONALITIES[st.bot].name;
      return st?.name || COLOR_NAME[shown?.players[s]?.color ?? "red"];
    },
    [match, seat, shown],
  );
  const view = usePresentation({ name, localSeats, animate: true });
  const { ingest, reset } = view;

  /** Shows queued frames one at a time, from timer callbacks. Kept in a ref so it always sees the latest `ingest`. */
  const pump = useRef<() => void>(() => {});
  useEffect(() => {
    pump.current = function next() {
      const frame = frames.current.shift();
      if (!frame) {
        timer.current = null;
        setPlaying(false);
        return;
      }
      setPlaying(true);
      setShown(frame.state);
      setShownVersion(frame.version);
      if (frame.events.length) ingest(frame.events);
      timer.current = setTimeout(() => pump.current(), frame.delayMs);
    };
  });
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const onRoom = useCallback(
    (next: Room) => {
      const prev = queued.current;
      if (next.version <= prev.version) return; // stale or duplicate update
      setRoom(next);
      setPending(false);
      queued.current = { version: next.version, state: next.state };
      if (!next.state) return;

      // A new game (first look, start, rematch) replays from the empty board; otherwise replay
      // from our last state, but only if we didn't miss an update in between.
      const newGame = !prev.state || prev.state.phase === "over" || next.state.turn < prev.state.turn;
      if (newGame) reset();
      const from = newGame
        ? createGame({ playerCount: next.match.playerCount, observationMode: next.match.observationMode })
        : next.version === prev.version + 1
          ? prev.state
          : null;
      // If the replay can't reproduce the server's state, just show the server's state.
      const replay = from && next.steps.length ? replaySteps(from, next.steps, next.state) : null;
      const batch: Frame[] = replay
        ? replay.states.map((state, i) => {
            const events = replay.events[i]!;
            const rolled = events.some((e) => e.type === "rolled");
            const mine = next.steps[i]!.seat === seat;
            return {
              state,
              events,
              delayMs: rolled ? ROLL_ANIM_MS + 250 : mine ? 120 : BOT_STEP_MS,
              version: next.version,
            };
          })
        : [{ state: next.state, events: [], delayMs: 0, version: next.version }];
      frames.current.push(...batch);
      if (!timer.current) pump.current();
    },
    [seat, reset],
  );

  // Live updates and presence for this room.
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchRoom(code)
        .then((r) => alive && r && onRoom(r))
        .catch((e: Error) => alive && setError(e.message));
    const channel = supabase()
      .channel(`room:${code}`, { config: { presence: { key: String(seat) } } })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `code=eq.${code}` }, (p) =>
        onRoom(p.new as Room),
      )
      .on("presence", { event: "sync" }, () => {
        setPresent(new Set(Object.keys(channel.presenceState()).map(Number)));
      })
      .subscribe((status) => {
        if (!alive) return;
        if (status === "SUBSCRIBED") {
          setConnected(true);
          void channel.track({ seat });
          void load(); // catch anything that changed while (re)connecting
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnected(false);
        }
      });
    void load();
    return () => {
      alive = false;
      void supabase().removeChannel(channel);
    };
  }, [code, seat, onRoom]);

  const send = useCallback(async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setPending(false);
      setError((e as Error).message);
    }
  }, []);

  const dispatch = useCallback(
    (action: Action) => {
      if (pending) return;
      setPending(true);
      void send(() => api.act(session, action));
    },
    [pending, send, session],
  );

  const idle = !playing && !!room && !!shown && shownVersion === room.version;
  const seatKind = useCallback(
    (s: number): SeatKind => (s === seat ? "local" : match?.seats[s]?.kind === "bot" ? "bot" : "remote"),
    [match, seat],
  );
  const offline = useMemo(
    () =>
      new Set(
        (match?.seats ?? [])
          .slice(0, match?.playerCount ?? 0)
          .flatMap((s, i) => (s.kind === "human" && i !== seat && !present.has(i) ? [i] : [])),
      ),
    [match, seat, present],
  );
  const legal = useMemo(() => (shown && idle ? legalActions(shown) : []), [shown, idle]);

  return {
    log: view.log,
    lastEvents: view.lastEvents,
    lastRoll: view.lastRoll,
    rolling: view.rolling,
    room,
    state: shown,
    legal,
    seat,
    host: session.host,
    present,
    isHumanTurn: !!shown && idle && !pending && connected && shown.phase !== "over" && shown.current === seat,
    localSeats,
    seatKind,
    offline,
    dispatch,
    name,
    notice: !connected ? "Reconnecting to the game server…" : error,
    start: () => send(() => api.start(session)),
    giveToBot: (s: number) => send(() => api.bot(session, s)),
  };
}
