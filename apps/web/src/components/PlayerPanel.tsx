import { HOME_POS, type GameState, type PlayerState } from "@qludo/engine";
import { COLOR_HEX, COLOR_SHAPE } from "../game/labels";

function ColorChip({ player, size = 16 }: { player: PlayerState; size?: number }) {
  const c = COLOR_HEX[player.color];
  const shape = COLOR_SHAPE[player.color];
  return (
    <svg viewBox="-1 -1 2 2" width={size} height={size} aria-hidden className="shrink-0">
      <circle r={0.95} fill={c.base} stroke={c.deep} strokeWidth={0.12} />
      {shape === "circle" && <circle r={0.38} fill={c.deep} />}
      {shape === "triangle" && <path d="M0 -0.5 L0.45 0.32 L-0.45 0.32 Z" fill={c.deep} />}
      {shape === "square" && <rect x={-0.35} y={-0.35} width={0.7} height={0.7} fill={c.deep} />}
      {shape === "diamond" && <path d="M0 -0.5 L0.5 0 L0 0.5 L-0.5 0 Z" fill={c.deep} />}
    </svg>
  );
}

function QPips({ q, max }: { q: number; max: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${q} of ${max} Q`}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full border ${i < q ? "border-split bg-split" : "border-line bg-transparent"}`}
        />
      ))}
    </span>
  );
}

export function points(p: PlayerState): number {
  return p.score.home + p.score.captures + p.score.captured;
}

export function PlayerPanel({
  state,
  name,
  badge,
  compact,
}: {
  state: GameState;
  name: (seat: number) => string;
  /** Small tag after the name: "bot", "remote", "offline". */
  badge: (seat: number) => string | null;
  compact?: boolean;
}) {
  const maxQ = state.config.rules.maxQ;
  return (
    <ul className={compact ? "grid grid-cols-2 gap-1.5 sm:grid-cols-4" : "flex flex-col gap-2"}>
      {state.players.map((p) => {
        const active = state.phase !== "over" && state.current === p.seat;
        const home = p.tokens.filter((t) => t.pos === HOME_POS).length;
        return (
          <li
            key={p.seat}
            className={`rounded-xl border px-2.5 py-1.5 transition-colors ${
              active ? "border-white/70 bg-panel-2" : "border-line bg-panel"
            }`}
            aria-current={active ? "true" : undefined}
          >
            <div className="flex items-center gap-1.5">
              <ColorChip player={p} size={compact ? 14 : 18} />
              <span className="truncate text-sm font-semibold">{name(p.seat)}</span>
              {badge(p.seat) && (
                <span
                  className={`rounded px-1 text-[10px] uppercase tracking-wide ${
                    badge(p.seat) === "offline" ? "bg-amber-400/20 text-amber-200" : "bg-line text-muted"
                  }`}
                >
                  {badge(p.seat)}
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted">
              <QPips q={p.q} max={maxQ} />
              <span title="Tokens home">{home}/4 home</span>
              <span className="font-semibold text-text tabular-nums" title="Points so far">
                {points(p)} pts
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export { ColorChip };
