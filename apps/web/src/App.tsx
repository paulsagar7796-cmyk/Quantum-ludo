import { useState } from "react";
import { GameScreen } from "./components/GameScreen";
import { Lobby } from "./components/Lobby";
import { loadMatch, saveMatch, type MatchConfig } from "./game/match";

export function App() {
  const [match, setMatch] = useState<MatchConfig | null>(null);
  // Bumping the key remounts the game screen, which starts a fresh game with the same settings.
  const [gameKey, setGameKey] = useState(0);

  if (!match) {
    return (
      <Lobby
        initial={loadMatch()}
        onStart={(m) => {
          saveMatch(m);
          setMatch(m);
        }}
      />
    );
  }
  return <GameScreen key={gameKey} match={match} onNewGame={() => setMatch(null)} onRematch={() => setGameKey((k) => k + 1)} />;
}
