import type { GameResult, GameState } from "@qludo/engine";
import { ColorChip } from "./PlayerPanel";
import { Modal } from "./Modal";

const PLACE = ["1st", "2nd", "3rd", "4th"];

export function Results({
  state,
  result,
  name,
  onRematch,
  onNewGame,
  onClose,
}: {
  state: GameState;
  result: GameResult;
  name: (seat: number) => string;
  onRematch: () => void;
  onNewGame: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title={result.reason === "finish" ? `${name(result.ranking[0]!)} wins!` : "Mercy cap reached"}
      onClose={onClose}
      wide
    >
      <p className="mb-3 text-sm text-muted">
        {result.rounds} rounds. Placement is the race: finisher first, then most tokens home, then shortest distance to
        home.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="py-1 pr-2 font-normal">Place</th>
              <th className="py-1 pr-2 font-normal">Player</th>
              <th className="py-1 pr-2 text-right font-normal" title="Tokens home">
                Home
              </th>
              <th className="py-1 pr-2 text-right font-normal">Captures</th>
              <th className="py-1 pr-2 text-right font-normal">Progress</th>
              <th className="py-1 pr-2 text-right font-normal">Placement</th>
              <th className="py-1 pr-2 text-right font-normal">Q</th>
              <th className="py-1 text-right font-semibold text-text">Total</th>
            </tr>
          </thead>
          <tbody>
            {result.ranking.map((seat, i) => {
              const s = result.scores[seat]!;
              return (
                <tr key={seat} className="border-t border-line">
                  <td className="py-2 pr-2 font-semibold">{PLACE[i]}</td>
                  <td className="py-2 pr-2">
                    <span className="flex items-center gap-1.5">
                      <ColorChip player={state.players[seat]!} />
                      {name(seat)}
                    </span>
                  </td>
                  <td className="py-2 pr-2 text-right">{s.home}</td>
                  <td className="py-2 pr-2 text-right">{s.captures + s.captured}</td>
                  <td className="py-2 pr-2 text-right">{s.progress}</td>
                  <td className="py-2 pr-2 text-right">{s.finishBonus}</td>
                  <td className="py-2 pr-2 text-right">{s.unspentQ}</td>
                  <td className="py-2 text-right text-base font-bold">{s.total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onRematch}
          className="min-h-11 flex-1 rounded-xl bg-white px-4 font-semibold text-ink hover:bg-slate-200"
        >
          Rematch
        </button>
        <button
          type="button"
          onClick={onNewGame}
          className="min-h-11 flex-1 rounded-xl border border-line bg-panel-2 px-4 font-semibold hover:bg-line"
        >
          New game
        </button>
      </div>
    </Modal>
  );
}
