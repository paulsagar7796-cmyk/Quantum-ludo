import { lazy, Suspense, useState, type ReactNode } from "react";
import { GameScreen } from "./components/GameScreen";
import { HostMatch } from "./components/Host";
import { JoinScreen } from "./components/Join";
import { Lobby } from "./components/Lobby";
import { loadMatch, saveMatch, type MatchConfig } from "./game/match";
import { clearSave, loadSave, type SavedGame } from "./game/save";
import { useGame } from "./game/useGame";
import { clearSession, loadSession } from "./online/session";
import type { OnlineSession } from "./online/useOnlineRoom";

// Online play (and the Supabase client it needs) only downloads when someone goes online.
const OnlineHost = lazy(() => import("./components/Online").then((m) => ({ default: m.OnlineHost })));
const OnlineJoin = lazy(() => import("./components/Online").then((m) => ({ default: m.OnlineJoin })));
const RoomView = lazy(() => import("./components/Online").then((m) => ({ default: m.RoomView })));

function Loading({ children }: { children: ReactNode }) {
  return <Suspense fallback={<p className="p-6 text-center text-sm text-muted">Loading…</p>}>{children}</Suspense>;
}

type View =
  | { kind: "lobby" }
  | { kind: "local"; match: MatchConfig; resume: SavedGame | null }
  | { kind: "host"; match: MatchConfig; resume: SavedGame | null }
  | { kind: "join" }
  | { kind: "onlineHost"; match: MatchConfig }
  | { kind: "onlineJoin"; code: string }
  | { kind: "onlineRoom"; session: OnlineSession };

const hasRemote = (m: MatchConfig) => m.seats.slice(0, m.playerCount).some((s) => s.kind === "remote");

/** An invite link (…/?room=ABCDE) opens the online join screen with the code filled in. */
function initialView(): View {
  const code = new URLSearchParams(location.search).get("room");
  if (code && /^[A-Za-z0-9]{5}$/.test(code)) {
    history.replaceState(null, "", location.pathname);
    return { kind: "onlineJoin", code: code.toUpperCase() };
  }
  return { kind: "lobby" };
}

function LocalGame({
  match,
  resume,
  onExit,
  onRematch,
}: {
  match: MatchConfig;
  resume: SavedGame | null;
  onExit: () => void;
  onRematch: () => void;
}) {
  const game = useGame(match, resume);
  return <GameScreen game={game} onLeave={onExit} onRematch={onRematch} />;
}

export function App() {
  const [view, setView] = useState<View>(initialView);
  /** What the lobby offers to resume. */
  const [saved, setSaved] = useState<SavedGame | null>(() => loadSave());
  const [online, setOnline] = useState<OnlineSession | null>(() => loadSession() as OnlineSession | null);
  // Bumping the key remounts a game, which starts a fresh one with the same settings.
  const [gameKey, setGameKey] = useState(0);

  const toLobby = () => {
    setSaved(loadSave());
    setOnline(loadSession() as OnlineSession | null);
    setView({ kind: "lobby" });
  };
  const play = (match: MatchConfig, resume: SavedGame | null) =>
    setView({ kind: hasRemote(match) ? "host" : "local", match, resume });

  switch (view.kind) {
    case "lobby":
      return (
        <Lobby
          initial={loadMatch()}
          saved={saved}
          onResume={(s) => play(s.match, s)}
          onDiscard={() => {
            clearSave();
            setSaved(null);
          }}
          onStart={(m, how) => {
            saveMatch(m);
            if (how === "online") setView({ kind: "onlineHost", match: m });
            else play(m, null);
          }}
          onJoinWifi={() => setView({ kind: "join" })}
          onJoinOnline={() => setView({ kind: "onlineJoin", code: "" })}
          online={online}
          onRejoinOnline={() => online && setView({ kind: "onlineRoom", session: online })}
          onForgetOnline={() => {
            clearSession();
            setOnline(null);
          }}
        />
      );
    case "local":
      return (
        <LocalGame
          key={gameKey}
          match={view.match}
          resume={view.resume}
          onExit={toLobby}
          onRematch={() => {
            setView({ ...view, resume: null });
            setGameKey((k) => k + 1);
          }}
        />
      );
    case "host":
      return <HostMatch initialMatch={view.match} resume={view.resume} onExit={toLobby} />;
    case "join":
      return <JoinScreen onExit={toLobby} />;
    case "onlineHost":
      return (
        <Loading>
          <OnlineHost match={view.match} onExit={toLobby} />
        </Loading>
      );
    case "onlineJoin":
      return (
        <Loading>
          <OnlineJoin initialCode={view.code} onExit={toLobby} />
        </Loading>
      );
    case "onlineRoom":
      return (
        <Loading>
          <RoomView session={view.session} onExit={toLobby} />
        </Loading>
      );
  }
}
