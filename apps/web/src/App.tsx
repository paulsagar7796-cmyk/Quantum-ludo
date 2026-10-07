import { useState } from "react";
import { GameScreen } from "./components/GameScreen";
import { HostMatch } from "./components/Host";
import { JoinScreen } from "./components/Join";
import { Lobby } from "./components/Lobby";
import { loadMatch, saveMatch, type MatchConfig } from "./game/match";
import { clearSave, loadSave, type SavedGame } from "./game/save";
import { useGame } from "./game/useGame";

type View =
  | { kind: "lobby" }
  | { kind: "local"; match: MatchConfig; resume: SavedGame | null }
  | { kind: "host"; match: MatchConfig; resume: SavedGame | null }
  | { kind: "join" };

const hasRemote = (m: MatchConfig) => m.seats.slice(0, m.playerCount).some((s) => s.kind === "remote");

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
  const [view, setView] = useState<View>({ kind: "lobby" });
  /** What the lobby offers to resume. */
  const [saved, setSaved] = useState<SavedGame | null>(() => loadSave());
  // Bumping the key remounts a game, which starts a fresh one with the same settings.
  const [gameKey, setGameKey] = useState(0);

  const toLobby = () => {
    setSaved(loadSave());
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
          onStart={(m) => {
            saveMatch(m);
            play(m, null);
          }}
          onJoin={() => setView({ kind: "join" })}
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
  }
}
