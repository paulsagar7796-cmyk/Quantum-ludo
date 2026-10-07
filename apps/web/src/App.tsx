import { useState } from "react";
import { GameScreen } from "./components/GameScreen";
import { Lobby } from "./components/Lobby";
import { loadMatch, saveMatch, type MatchConfig } from "./game/match";
import { clearSave, loadSave, type SavedGame } from "./game/save";

export function App() {
  const [match, setMatch] = useState<MatchConfig | null>(null);
  /** The saved game to continue, when the player chose Resume. */
  const [resume, setResume] = useState<SavedGame | null>(null);
  /** What the lobby offers to resume. */
  const [saved, setSaved] = useState<SavedGame | null>(() => loadSave());
  // Bumping the key remounts the game screen, which starts a fresh game with the same settings.
  const [gameKey, setGameKey] = useState(0);

  if (!match) {
    return (
      <Lobby
        initial={loadMatch()}
        saved={saved}
        onResume={(s) => {
          setResume(s);
          setMatch(s.match);
        }}
        onDiscard={() => {
          clearSave();
          setSaved(null);
        }}
        onStart={(m) => {
          saveMatch(m);
          setResume(null);
          setMatch(m);
        }}
      />
    );
  }
  return (
    <GameScreen
      key={gameKey}
      match={match}
      resume={resume}
      onNewGame={() => {
        setSaved(loadSave());
        setResume(null);
        setMatch(null);
      }}
      onRematch={() => {
        setResume(null);
        setGameKey((k) => k + 1);
      }}
    />
  );
}
