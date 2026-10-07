import type { GameState } from "@qludo/engine";
import { useEffect, useState } from "react";
import type { GameController } from "../game/controller";
import { COLOR_HEX } from "../game/labels";
import { answerInvite, makeLink, whenOpen, type GuestJoin, type Link } from "../net/peer";
import { useGuestGame } from "../net/useGuestGame";
import { GameScreen } from "./GameScreen";
import { QrCode } from "./QrCode";
import { QrScanner } from "./QrScanner";

const NAME_KEY = "qludo.name.v1";

function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Joining someone else's Wi-Fi game: scan their invite, show a reply, then play. */
export function JoinScreen({ onExit }: { onExit: () => void }) {
  const [name, setName] = useState(loadName);
  const [join, setJoin] = useState<GuestJoin | null>(null);
  const [link, setLink] = useState<Link | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Leaving closes the connection.
  useEffect(() => () => join?.pc.close(), [join]);

  const onInvite = async (code: string) => {
    setBusy(true);
    setError(null);
    try {
      const player = name.trim() || "Guest";
      try {
        localStorage.setItem(NAME_KEY, player);
      } catch {
        // Not critical.
      }
      const j = await answerInvite(code, player);
      setJoin(j);
      j.channel
        .then(async (ch) => {
          const l = makeLink(ch); // buffer from the very first message
          await whenOpen(ch, 120_000);
          setLink(l);
        })
        .catch((e: Error) => setError(`${e.message} Ask the host for a new invite.`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (join && link) return <GuestView link={link} seat={join.seat} onExit={onExit} />;

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col gap-4 px-4 py-6">
      <header>
        <h1 className="text-2xl font-black tracking-tight">Join on this Wi-Fi</h1>
        <p className="mt-1 text-sm text-muted">
          Join the host&rsquo;s Wi-Fi (or their phone&rsquo;s hotspot) first. No internet is needed.
        </p>
      </header>

      {!join ? (
        <>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Your name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={16}
              placeholder="Guest"
              className="min-h-11 rounded-lg border border-line bg-panel-2 px-3"
            />
          </label>
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">
              <b>1.</b> Scan the invite on the host&rsquo;s screen
            </h2>
            <QrScanner label="Or paste the invite code" onCode={(c) => void onInvite(c)} busy={busy} />
          </section>
        </>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">
            <b>2.</b> Show this reply to the host
          </h2>
          <p className="text-sm text-muted">
            The host reads it with &ldquo;Read their reply&rdquo;. You&rsquo;ll join as soon as they do.
          </p>
          <QrCode code={join.code} label="Your reply code" />
          <p className="text-center text-sm text-muted" role="status">
            Waiting for {join.hostName} to connect…
          </p>
        </section>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-amber-400/50 bg-amber-400/10 px-3 py-2 text-sm text-amber-200"
        >
          {error}
        </p>
      )}

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

function GuestView({ link, seat, onExit }: { link: Link; seat: number; onExit: () => void }) {
  const g = useGuestGame(link, seat);

  if (!g.state || !g.match) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
        {g.connected ? (
          <>
            <p className="text-xl font-bold">Connected!</p>
            <p className="text-sm text-muted" role="status">
              Waiting for the host to start the game…
            </p>
            {g.match && (
              <ul className="flex flex-wrap justify-center gap-2 text-sm">
                {g.match.seats.slice(0, g.match.playerCount).map((_, i) => (
                  <li key={i} className="rounded-lg border border-line bg-panel px-2 py-1">
                    {g.name(i)}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm text-amber-200">The host closed the game.</p>
        )}
        <button
          type="button"
          onClick={onExit}
          className="min-h-11 rounded-xl border border-line bg-panel px-6 text-sm font-semibold hover:bg-panel-2"
        >
          Back to lobby
        </button>
      </div>
    );
  }

  const me = g.state.players[seat];
  return (
    <GameScreen
      historyMode="guest"
      game={{ ...g, state: g.state as GameState } as GameController}
      onLeave={onExit}
      leaveText="You will leave this game. The host can invite you again."
      toolbarExtra={
        me && (
          <span className="hidden items-center gap-1 px-1 text-xs text-muted sm:flex">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR_HEX[me.color].base }} aria-hidden />
            You
          </span>
        )
      }
    />
  );
}
