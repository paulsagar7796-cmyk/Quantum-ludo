import { SEAT_COLORS, type GameEvent, type GameState } from "@qludo/engine";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COLOR_HEX, COLOR_NAME } from "../game/labels";
import { seatName, type MatchConfig } from "../game/match";
import type { SavedGame } from "../game/save";
import { useGame, type AuthorityController } from "../game/useGame";
import { useHostConnections, type HostConnections, type PeerSlot } from "../net/useHostConnections";
import { GameScreen } from "./GameScreen";
import { Modal } from "./Modal";
import { QrCode } from "./QrCode";
import { QrScanner } from "./QrScanner";

function remoteSeatsOf(match: MatchConfig): number[] {
  return match.seats.slice(0, match.playerCount).flatMap((s, i) => (s.kind === "remote" ? [i] : []));
}

const STATUS_TEXT: Record<PeerSlot["status"], string> = {
  idle: "Not invited yet",
  creating: "Preparing invite…",
  inviting: "Invite ready",
  connecting: "Connecting…",
  connected: "Connected",
  offline: "Disconnected",
};

/** One row per remote seat: invite, show the code, read the reply, see who joined. */
function ConnectionPanel({
  match,
  conns,
  onMakeBot,
}: {
  match: MatchConfig;
  conns: HostConnections;
  onMakeBot: (seat: number) => void;
}) {
  const [replyFor, setReplyFor] = useState<number | null>(null);
  const colors = SEAT_COLORS[match.playerCount];
  const seats = remoteSeatsOf(match);

  if (seats.length === 0) return <p className="text-sm text-muted">No remote seats in this game.</p>;

  return (
    <ul className="flex flex-col gap-3">
      {seats.map((seat) => {
        const slot = conns.slots[seat] ?? { status: "idle", code: null, error: null };
        const color = colors[seat]!;
        const joined = slot.status === "connected" || slot.status === "connecting";
        return (
          <li
            key={seat}
            className="rounded-xl border border-line bg-panel p-3"
            aria-label={`${COLOR_NAME[color]} seat`}
          >
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-full" style={{ background: COLOR_HEX[color].base }} aria-hidden />
              <span className="font-semibold">
                {COLOR_NAME[color]}
                {joined && match.seats[seat]!.name ? ` · ${match.seats[seat]!.name}` : ""}
              </span>
              <span
                className={`ml-auto text-xs ${
                  slot.status === "connected"
                    ? "text-emerald-300"
                    : slot.status === "offline"
                      ? "text-amber-200"
                      : "text-muted"
                }`}
              >
                {STATUS_TEXT[slot.status]}
              </span>
            </div>

            {slot.status === "inviting" && slot.code && (
              <div className="mt-3 flex flex-col gap-3">
                <p className="text-sm text-muted">
                  <b className="text-text">1.</b> On the other device, tap <b className="text-text">Join a game</b> and
                  scan this invite.
                </p>
                <QrCode code={slot.code} label={`Invite for ${COLOR_NAME[color]}`} />
                <p className="text-sm text-muted">
                  <b className="text-text">2.</b> Then read the reply code shown on their screen.
                </p>
                {replyFor === seat ? (
                  <QrScanner label="Their reply code" onCode={(code) => void conns.accept(seat, code)} />
                ) : (
                  <button
                    type="button"
                    onClick={() => setReplyFor(seat)}
                    className="min-h-11 rounded-xl bg-white font-semibold text-ink hover:bg-slate-200"
                  >
                    Read their reply
                  </button>
                )}
              </div>
            )}

            {slot.error && <p className="mt-2 text-sm text-amber-200">{slot.error}</p>}

            <div className="mt-3 flex gap-2">
              {(slot.status === "idle" || slot.status === "offline") && (
                <button
                  type="button"
                  onClick={() => void conns.invite(seat)}
                  className="min-h-10 flex-1 rounded-lg bg-white text-sm font-semibold text-ink hover:bg-slate-200"
                >
                  {slot.status === "offline" ? "Invite again" : "Invite player"}
                </button>
              )}
              {slot.status !== "connected" && (
                <button
                  type="button"
                  onClick={() => onMakeBot(seat)}
                  className="min-h-10 rounded-lg border border-line bg-panel-2 px-3 text-sm font-semibold hover:bg-line"
                >
                  Use a bot instead
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** The host's whole Wi-Fi game: the waiting room, then the game, sharing one set of connections. */
export function HostMatch({
  initialMatch,
  resume,
  onExit,
}: {
  initialMatch: MatchConfig;
  resume: SavedGame | null;
  onExit: () => void;
}) {
  const [match, setMatch] = useState(initialMatch);
  const [phase, setPhase] = useState<"room" | "game">(resume ? "game" : "room");
  const [gameKey, setGameKey] = useState(0);
  const game = useRef<AuthorityController | null>(null);
  const matchRef = useRef(match);
  useEffect(() => {
    matchRef.current = match;
  });

  const remoteSeats = useMemo(() => remoteSeatsOf(match), [match]);
  const hostName = seatName(
    match,
    match.seats.findIndex((s) => s.kind === "human"),
  );

  const conns = useHostConnections(remoteSeats, hostName === "You" ? "the host" : hostName, {
    onName: (seat, name) =>
      setMatch((m) => ({ ...m, seats: m.seats.map((s, i) => (i === seat ? { ...s, name: name.slice(0, 16) } : s)) })),
    onJoined: (seat) =>
      conns.sendTo(seat, {
        t: "welcome",
        seat,
        match: matchRef.current,
        state: game.current?.stateRef.current ?? null,
        lastRoll: game.current?.lastRoll ?? null,
      }),
    onAction: (seat, action) => {
      const g = game.current;
      // If the host rejects the action, re-send the state so the guest can try again.
      if (g && !g.applyRemote(seat, action)) conns.sendTo(seat, { t: "sync", state: g.stateRef.current, events: [] });
    },
  });
  const { broadcast } = conns;

  // Everyone sees joined names.
  useEffect(() => broadcast({ t: "match", match }), [broadcast, match]);

  const makeBot = (seat: number) => {
    conns.release(seat);
    setMatch((m) => ({ ...m, seats: m.seats.map((s, i) => (i === seat ? { ...s, kind: "bot", name: "" } : s)) }));
  };

  const allJoined = remoteSeats.every((s) => conns.slots[s]?.status === "connected");

  if (phase === "room") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col gap-4 px-4 py-6">
        <header>
          <h1 className="text-2xl font-black tracking-tight">Host a Wi-Fi game</h1>
          <p className="mt-1 text-sm text-muted">
            Everyone needs to be on the same Wi-Fi, or on your phone&rsquo;s hotspot. No internet is needed.
          </p>
        </header>
        <ConnectionPanel match={match} conns={conns} onMakeBot={makeBot} />
        <div className="mt-auto flex flex-col gap-2">
          <button
            type="button"
            disabled={!allJoined}
            onClick={() => setPhase("game")}
            className="min-h-12 rounded-xl bg-white text-base font-bold text-ink hover:bg-slate-200 disabled:opacity-40"
          >
            {allJoined ? "Start game" : "Waiting for players…"}
          </button>
          <button
            type="button"
            onClick={onExit}
            className="min-h-11 rounded-xl border border-line bg-panel text-sm font-semibold hover:bg-panel-2"
          >
            Back to lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <HostGame
      key={gameKey}
      match={match}
      resume={gameKey === 0 ? resume : null}
      conns={conns}
      gameRef={game}
      onMakeBot={makeBot}
      onExit={() => {
        broadcast({ t: "bye", reason: "The host left the game." });
        onExit();
      }}
      onRematch={() => setGameKey((k) => k + 1)}
    />
  );
}

function HostGame({
  match,
  resume,
  conns,
  gameRef,
  onMakeBot,
  onExit,
  onRematch,
}: {
  match: MatchConfig;
  resume: SavedGame | null;
  conns: HostConnections;
  gameRef: { current: AuthorityController | null };
  onMakeBot: (seat: number) => void;
  onExit: () => void;
  onRematch: () => void;
}) {
  const [showPlayers, setShowPlayers] = useState(false);
  const { broadcast, offline } = conns;
  const onApplied = useCallback(
    (state: GameState, events: GameEvent[]) => broadcast({ t: "sync", state, events }),
    [broadcast],
  );
  const missing = [...offline].map((s) => seatName(match, s) || COLOR_NAME[SEAT_COLORS[match.playerCount][s]!]);
  const notice =
    missing.length > 0
      ? `${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} not connected. Use Players to invite them again or swap in a bot.`
      : null;

  const g = useGame(match, resume, { onApplied, offline, notice });
  useEffect(() => {
    gameRef.current = g;
  });
  // Tell guests a (new) game has started.
  useEffect(() => {
    broadcast({ t: "start", state: g.stateRef.current });
  }, [broadcast, g.stateRef]);

  return (
    <>
      <GameScreen
        historyMode="host"
        game={g}
        onLeave={onExit}
        onRematch={onRematch}
        leaveText="Your game is saved. The other players will be disconnected; you can invite them again when you resume."
        toolbarExtra={
          <button
            type="button"
            onClick={() => setShowPlayers(true)}
            className="rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-panel-2 hover:text-text"
          >
            Players{offline.size > 0 ? ` (${offline.size} offline)` : ""}
          </button>
        }
      />
      {showPlayers && (
        <Modal title="Players" onClose={() => setShowPlayers(false)} wide>
          <ConnectionPanel match={match} conns={conns} onMakeBot={onMakeBot} />
        </Modal>
      )}
    </>
  );
}
