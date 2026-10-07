import { PERSONALITIES } from "@qludo/bots";
import { SEAT_COLORS, type GameState } from "@qludo/engine";
import type { RoomMatch } from "@qludo/server";
import { useState } from "react";
import type { GameController } from "../game/controller";
import { COLOR_HEX, COLOR_NAME } from "../game/labels";
import type { MatchConfig } from "../game/match";
import { api } from "../online/api";
import { clearSession, saveSession } from "../online/session";
import { useOnlineRoom, type OnlineRoom, type OnlineSession } from "../online/useOnlineRoom";
import { GameScreen } from "./GameScreen";
import { Modal } from "./Modal";

const NAME_KEY = "qludo.name.v1";

function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

function rememberName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // Not critical.
  }
}

/** Lobby seats → room seats: bots stay bots, every other seat is for a person online. */
export function toRoomMatch(m: MatchConfig): RoomMatch {
  return {
    playerCount: m.playerCount,
    observationMode: m.observationMode,
    seats: m.seats.map((s) => ({ kind: s.kind === "bot" ? "bot" : "human", bot: s.bot, name: "" })),
  };
}

export function roomLink(code: string): string {
  return `${location.origin}/?room=${code}`;
}

function Shell({ title, children, onExit }: { title: string; children: React.ReactNode; onExit: () => void }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-black tracking-tight">{title}</h1>
      {children}
      <button
        type="button"
        onClick={onExit}
        className="mt-auto min-h-11 rounded-xl border border-line bg-panel text-sm font-semibold hover:bg-panel-2"
      >
        Back to lobby
      </button>
    </div>
  );
}

function NameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted">Your name</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={16}
        placeholder="Player"
        className="min-h-11 rounded-lg border border-line bg-panel-2 px-3"
      />
    </label>
  );
}

function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-xl border border-amber-400/50 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
      {error}
    </p>
  );
}

/** Create an online room from the lobby's settings. */
export function OnlineHost({ match, onExit }: { match: MatchConfig; onExit: () => void }) {
  const [name, setName] = useState(loadName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<OnlineSession | null>(null);

  if (session) return <RoomView session={session} onExit={onExit} />;

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const player = name.trim() || "Host";
      rememberName(player);
      const seat = await api.create(player, toRoomMatch(match));
      const s = { ...seat, host: true };
      saveSession(s);
      setSession(s);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Host an online room" onExit={onExit}>
      <p className="text-sm text-muted">
        Friends can join from anywhere with the room code. The server rolls the dice and checks every move.
      </p>
      <NameField value={name} onChange={setName} />
      <ErrorNote error={error} />
      <button
        type="button"
        disabled={busy}
        onClick={() => void create()}
        className="min-h-12 rounded-xl bg-white text-base font-bold text-ink hover:bg-slate-200 disabled:opacity-40"
      >
        {busy ? "Creating…" : "Create room"}
      </button>
    </Shell>
  );
}

/** Join an online room with its code. */
export function OnlineJoin({ initialCode = "", onExit }: { initialCode?: string; onExit: () => void }) {
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<OnlineSession | null>(null);

  if (session) return <RoomView session={session} onExit={onExit} />;

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      const player = name.trim() || "Player";
      rememberName(player);
      const seat = await api.join(code.trim().toUpperCase(), player);
      const s = { ...seat, host: false };
      saveSession(s);
      setSession(s);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Join an online room" onExit={onExit}>
      <NameField value={name} onChange={setName} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">Room code</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={5}
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="ABCDE"
          className="min-h-12 rounded-lg border border-line bg-panel-2 px-3 text-center font-mono text-2xl tracking-[0.4em]"
        />
      </label>
      <ErrorNote error={error} />
      <button
        type="button"
        disabled={busy || code.trim().length !== 5}
        onClick={() => void join()}
        className="min-h-12 rounded-xl bg-white text-base font-bold text-ink hover:bg-slate-200 disabled:opacity-40"
      >
        {busy ? "Joining…" : "Join room"}
      </button>
    </Shell>
  );
}

/** Rejoin a saved room, or play one just created/joined. */
export function RoomView({ session, onExit }: { session: OnlineSession; onExit: () => void }) {
  const room = useOnlineRoom(session);
  if (!room.room || (room.room.status !== "lobby" && !room.state)) {
    return (
      <Shell title="Online room" onExit={onExit}>
        {room.notice ? <ErrorNote error={room.notice} /> : <p className="text-sm text-muted">Connecting…</p>}
      </Shell>
    );
  }
  if (room.room.status === "lobby") return <RoomLobby room={room} onExit={onExit} />;
  return <RoomGame room={room} onExit={onExit} />;
}

function SeatList({ room, onBot }: { room: OnlineRoom; onBot?: (seat: number) => void }) {
  const match = room.room!.match;
  const colors = SEAT_COLORS[match.playerCount];
  return (
    <ul className="flex flex-col gap-2">
      {colors.map((color, i) => {
        const s = match.seats[i]!;
        const joined = s.kind === "human" && !!s.name;
        const label =
          s.kind === "bot"
            ? PERSONALITIES[s.bot].name
            : joined
              ? i === room.seat
                ? `${s.name} (you)`
                : s.name
              : "Waiting…";
        const online = i === room.seat || room.present.has(i);
        return (
          <li
            key={color}
            className="flex items-center gap-2 rounded-xl border border-line bg-panel p-3"
            aria-label={`${COLOR_NAME[color]} seat`}
          >
            <span className="h-4 w-4 rounded-full" style={{ background: COLOR_HEX[color].base }} aria-hidden />
            <span className={`font-semibold ${joined || s.kind === "bot" ? "" : "text-muted"}`}>{label}</span>
            <span className="ml-auto text-xs text-muted">
              {s.kind === "bot" ? "bot" : joined ? (online ? "online" : "offline") : ""}
            </span>
            {onBot && s.kind === "human" && i !== room.seat && (!joined || !online) && (
              <button
                type="button"
                onClick={() => onBot(i)}
                className="min-h-9 rounded-lg border border-line bg-panel-2 px-2 text-xs font-semibold hover:bg-line"
              >
                Use a bot
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function RoomLobby({ room, onExit }: { room: OnlineRoom; onExit: () => void }) {
  const r = room.room!;
  const [copied, setCopied] = useState(false);
  const allJoined = r.match.seats.slice(0, r.match.playerCount).every((s) => s.kind === "bot" || !!s.name);

  const share = async () => {
    const link = roomLink(r.code);
    try {
      if (navigator.share)
        await navigator.share({ title: "Quantum Ludo", text: `Join my Quantum Ludo room: ${r.code}`, url: link });
      else {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      // Sharing was cancelled.
    }
  };

  return (
    <Shell title="Online room" onExit={onExit}>
      <section className="rounded-2xl border border-split/50 bg-split/10 p-4 text-center">
        <p className="text-sm text-muted">Room code</p>
        <p className="font-mono text-5xl font-black tracking-[0.3em]" aria-label="Room code">
          {r.code}
        </p>
        <button
          type="button"
          onClick={() => void share()}
          className="mt-3 min-h-10 rounded-lg border border-line bg-panel-2 px-4 text-sm font-semibold hover:bg-line"
        >
          {copied ? "Link copied!" : "Share invite link"}
        </button>
      </section>
      <SeatList room={room} onBot={room.host ? (s) => void room.giveToBot(s) : undefined} />
      <ErrorNote error={room.notice} />
      {room.host ? (
        <button
          type="button"
          disabled={!allJoined}
          onClick={() => void room.start()}
          className="min-h-12 rounded-xl bg-white text-base font-bold text-ink hover:bg-slate-200 disabled:opacity-40"
        >
          {allJoined ? "Start game" : "Waiting for players…"}
        </button>
      ) : (
        <p className="text-center text-sm text-muted" role="status">
          Waiting for the host to start…
        </p>
      )}
    </Shell>
  );
}

function RoomGame({ room, onExit }: { room: OnlineRoom; onExit: () => void }) {
  const [showPlayers, setShowPlayers] = useState(false);
  const game = { ...room, state: room.state as GameState } as GameController;
  return (
    <>
      <GameScreen
        historyMode="online"
        game={game}
        onLeave={onExit}
        onRematch={room.host ? () => void room.start() : undefined}
        leaveText="You can rejoin this room from the lobby while it lasts."
        toolbarExtra={
          room.host && (
            <button
              type="button"
              onClick={() => setShowPlayers(true)}
              className="rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-panel-2 hover:text-text"
            >
              Players{room.offline.size > 0 ? ` (${room.offline.size} offline)` : ""}
            </button>
          )
        }
      />
      {showPlayers && (
        <Modal title={`Room ${room.room!.code}`} onClose={() => setShowPlayers(false)} wide>
          <SeatList room={room} onBot={(s) => void room.giveToBot(s)} />
        </Modal>
      )}
    </>
  );
}

export function forgetRoom(): void {
  clearSession();
}
