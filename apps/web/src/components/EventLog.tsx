import type { GameState } from "@qludo/engine";
import type { LogLine, Tone } from "../game/format";
import { COLOR_HEX } from "../game/labels";

const TONE: Record<Tone, string> = {
  neutral: "text-muted",
  good: "text-emerald-300",
  bad: "text-rose-300",
  quantum: "text-violet-300",
};

export function EventLog({ log, state, limit }: { log: LogLine[]; state: GameState; limit?: number }) {
  const lines = limit ? log.slice(0, limit) : log;
  if (lines.length === 0) return <p className="text-sm text-muted">Moves will appear here.</p>;
  return (
    <ol className="flex flex-col gap-1 text-sm" aria-live="polite">
      {lines.map((l) => (
        <li key={l.id} className={`flex items-start gap-2 ${TONE[l.tone]}`}>
          <span
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
            style={{ background: l.seat === null ? "#94a3b8" : COLOR_HEX[state.players[l.seat]!.color].base }}
            aria-hidden
          />
          <span>{l.text}</span>
        </li>
      ))}
    </ol>
  );
}
