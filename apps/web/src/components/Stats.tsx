import { useState } from "react";
import { clearHistory, loadHistory, statsOf, type GameRecord } from "../game/history";
import { COLOR_HEX } from "../game/labels";
import { Modal } from "./Modal";

const PLACE = ["1st", "2nd", "3rd", "4th"];
const MODE: Record<GameRecord["mode"], string> = {
  local: "This device",
  host: "Wi-Fi (host)",
  guest: "Wi-Fi (guest)",
  online: "Online",
};

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel-2 p-3 text-center">
      <div className="text-2xl font-black tabular-nums">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

/** Lifetime stats and recent games played on this device. */
export function Stats({ onClose }: { onClose: () => void }) {
  const [history, setHistory] = useState(loadHistory);
  const [confirmClear, setConfirmClear] = useState(false);
  const s = statsOf(history);

  return (
    <Modal title="Your stats" onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="Games" value={String(s.games)} />
        <Tile label="Wins" value={String(s.wins)} />
        <Tile label="Win rate" value={s.games ? `${Math.round(s.winRate * 100)}%` : "–"} />
        <Tile label="Best score" value={s.games ? String(s.bestScore) : "–"} />
      </div>
      <p className="mt-2 text-xs text-muted">
        Counts games with a player on this device. Average score {s.games ? s.averageScore.toFixed(1) : "–"}.
      </p>

      <h3 className="mt-4 mb-2 text-sm font-semibold">Recent games</h3>
      {history.length === 0 ? (
        <p className="text-sm text-muted">Finished games will show up here.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {history.slice(0, 20).map((g) => {
            const me = g.players.filter((p) => p.mine).sort((a, b) => a.place - b.place)[0];
            return (
              <li key={g.id} className="rounded-xl border border-line bg-panel p-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{me ? `${PLACE[me.place - 1]} · ${me.total} pts` : "Spectated"}</span>
                  <span className="text-xs text-muted">
                    {new Date(g.endedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })} ·{" "}
                    {MODE[g.mode]} · {g.rounds} rounds
                  </span>
                </div>
                <ol className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                  {g.players.map((p) => (
                    <li key={p.seat} className="flex items-center gap-1">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: COLOR_HEX[p.color].base }}
                        aria-hidden
                      />
                      <span className={p.mine ? "text-text" : undefined}>
                        {p.place}. {p.name} {p.total}
                      </span>
                    </li>
                  ))}
                </ol>
              </li>
            );
          })}
        </ul>
      )}

      {history.length > 0 &&
        (confirmClear ? (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => {
                clearHistory();
                setHistory([]);
                setConfirmClear(false);
              }}
              className="min-h-10 flex-1 rounded-lg bg-rose-500/90 text-sm font-semibold text-white hover:bg-rose-500"
            >
              Yes, clear history
            </button>
            <button
              type="button"
              onClick={() => setConfirmClear(false)}
              className="min-h-10 flex-1 rounded-lg border border-line bg-panel-2 text-sm font-semibold hover:bg-line"
            >
              Keep it
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="mt-4 min-h-10 w-full rounded-lg border border-line bg-panel-2 text-sm text-muted hover:bg-line"
          >
            Clear history
          </button>
        ))}
    </Modal>
  );
}
