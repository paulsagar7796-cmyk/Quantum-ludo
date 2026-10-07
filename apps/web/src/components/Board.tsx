import {
  COLORS,
  SAFE_SQUARES,
  START_SQUARE,
  STAR_SQUARES,
  type Color,
  type GameState,
  type MarkerIndex,
} from "@qludo/engine";
import { memo, type ReactNode } from "react";
import { COLOR_HEX, COLOR_SHAPE } from "../game/labels";
import { GRID, HOME_COLUMN, TRACK, YARD_ORIGIN, centre, pointFor, pointKey, type Point } from "../game/layout";

export type PreviewKind = "move" | "split" | "ghost";

export interface Preview {
  point: Point;
  kind: PreviewKind;
  label?: string;
  onClick: () => void;
}

export interface MarkerTarget {
  seat: number;
  token: number;
  marker: MarkerIndex;
  onClick: () => void;
}

interface BoardProps {
  state: GameState;
  /** Seat whose tokens can be tapped, and which of its tokens. */
  selectable: { seat: number; tokens: Set<number> } | null;
  selected: number | null;
  previews: Preview[];
  markerTargets: MarkerTarget[];
  onTokenClick: (seat: number, token: number) => void;
}

const SPLIT_COLOR = "#a78bfa";
const LINK_COLOR = "#22d3ee";

function Shape({ shape, size, fill }: { shape: (typeof COLOR_SHAPE)[Color]; size: number; fill: string }) {
  const s = size;
  switch (shape) {
    case "circle":
      return <circle r={s * 0.55} fill={fill} />;
    case "triangle":
      return <path d={`M0 ${-s * 0.7} L${s * 0.65} ${s * 0.45} L${-s * 0.65} ${s * 0.45} Z`} fill={fill} />;
    case "square":
      return <rect x={-s * 0.5} y={-s * 0.5} width={s} height={s} fill={fill} />;
    case "diamond":
      return <path d={`M0 ${-s * 0.72} L${s * 0.72} 0 L0 ${s * 0.72} L${-s * 0.72} 0 Z`} fill={fill} />;
  }
}

function Token({ color, dashed, faded }: { color: Color; dashed?: boolean; faded?: boolean }) {
  const c = COLOR_HEX[color];
  return (
    <g opacity={faded ? 0.55 : 1}>
      <circle
        r={0.36}
        fill={dashed ? "transparent" : c.base}
        stroke={dashed ? c.base : c.deep}
        strokeWidth={dashed ? 0.07 : 0.05}
        strokeDasharray={dashed ? "0.12 0.08" : undefined}
      />
      {dashed ? (
        <text y={0.13} textAnchor="middle" fontSize={0.38} fontWeight={700} fill={c.base}>
          ?
        </text>
      ) : (
        <Shape shape={COLOR_SHAPE[color]} size={0.3} fill={c.deep} />
      )}
    </g>
  );
}

function Star({ x, y }: Point) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? 0.32 : 0.14;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    return `${x + r * Math.cos(a)},${y + r * Math.sin(a)}`;
  }).join(" ");
  return <polygon points={pts} fill="#cbd5e1" opacity={0.55} />;
}

/** Spread tokens that share a point so they stay tappable. */
function spread(n: number, i: number): { dx: number; dy: number; scale: number } {
  if (n <= 1) return { dx: 0, dy: 0, scale: 1 };
  if (n === 2) return { dx: i === 0 ? -0.2 : 0.2, dy: 0, scale: 0.72 };
  const col = i % 2;
  const row = Math.floor(i / 2);
  return { dx: col === 0 ? -0.2 : 0.2, dy: row === 0 ? -0.2 : 0.2, scale: 0.62 };
}

function Static({ state }: { state: GameState }) {
  const used = new Set(state.players.map((p) => p.color));
  const cells: ReactNode[] = [];

  COLORS.forEach((color) => {
    const [ox, oy] = YARD_ORIGIN[color];
    const c = COLOR_HEX[color];
    const active = used.has(color);
    cells.push(
      <g key={`yard-${color}`} opacity={active ? 1 : 0.25}>
        <rect x={ox + 0.1} y={oy + 0.1} width={5.8} height={5.8} rx={0.5} fill={c.base} />
        <rect x={ox + 0.9} y={oy + 0.9} width={4.2} height={4.2} rx={0.4} fill="var(--board-surface)" />
        {[0, 1, 2, 3].map((t) => {
          const p = pointFor(color, -1, t);
          return <circle key={t} cx={p.x} cy={p.y} r={0.45} fill={c.tint} opacity={0.6} />;
        })}
      </g>,
    );
    HOME_COLUMN[color].forEach(([x, y], i) =>
      cells.push(
        <rect
          key={`hc-${color}-${i}`}
          x={x + 0.04}
          y={y + 0.04}
          width={0.92}
          height={0.92}
          rx={0.12}
          fill={c.base}
          opacity={active ? 0.8 : 0.2}
        />,
      ),
    );
  });

  TRACK.forEach(([x, y], sq) => {
    const startColor = COLORS.find((c) => START_SQUARE[c] === sq);
    cells.push(
      <rect
        key={`t-${sq}`}
        x={x + 0.04}
        y={y + 0.04}
        width={0.92}
        height={0.92}
        rx={0.12}
        fill={startColor ? COLOR_HEX[startColor].base : "var(--board-cell)"}
        opacity={startColor && !used.has(startColor) ? 0.35 : 1}
      />,
    );
  });

  const tri = (a: Point, b: Point, color: Color) => (
    <polygon
      key={`tri-${color}`}
      points={`${a.x},${a.y} ${b.x},${b.y} 7.5,7.5`}
      fill={COLOR_HEX[color].base}
      opacity={used.has(color) ? 0.9 : 0.25}
    />
  );

  return (
    <g>
      <rect x={0} y={0} width={GRID} height={GRID} rx={0.6} fill="var(--board-surface)" />
      {cells}
      {tri({ x: 6, y: 6 }, { x: 6, y: 9 }, "red")}
      {tri({ x: 6, y: 6 }, { x: 9, y: 6 }, "green")}
      {tri({ x: 9, y: 6 }, { x: 9, y: 9 }, "yellow")}
      {tri({ x: 6, y: 9 }, { x: 9, y: 9 }, "blue")}
      {STAR_SQUARES.map((sq) => (
        <Star key={`star-${sq}`} {...centre(TRACK[sq]!)} />
      ))}
    </g>
  );
}

const StaticBoard = memo(Static, (a, b) => a.state.players.length === b.state.players.length);

export function Board({ state, selectable, selected, previews, markerTargets, onTokenClick }: BoardProps) {
  const current = state.players[state.current]!;

  // Nodes: safe squares glow when they can pay out this round.
  const nodes = [...SAFE_SQUARES].map((sq) => {
    const p = centre(TRACK[sq]!);
    const dormant = state.nodeHarvestRound[sq] === state.round;
    return (
      <circle
        key={`node-${sq}`}
        cx={p.x}
        cy={p.y}
        r={0.44}
        fill="none"
        stroke="#c4b5fd"
        strokeWidth={0.05}
        strokeDasharray={dormant ? "0.08 0.12" : undefined}
        opacity={dormant ? 0.3 : 0.9}
        className={dormant ? undefined : "node-glow"}
      />
    );
  });

  // Real tokens, grouped by the point they occupy.
  type Placed = { seat: number; token: number; color: Color; point: Point; drifting: boolean };
  const placed: Placed[] = [];
  const markers: { seat: number; token: number; color: Color; marker: MarkerIndex; point: Point }[] = [];
  for (const p of state.players) {
    p.tokens.forEach((t, i) => {
      if (t.split) {
        t.split.forEach((m, mi) =>
          markers.push({
            seat: p.seat,
            token: i,
            color: p.color,
            marker: mi as MarkerIndex,
            point: pointFor(p.color, m, i),
          }),
        );
      } else {
        placed.push({
          seat: p.seat,
          token: i,
          color: p.color,
          point: pointFor(p.color, t.pos, i),
          drifting: t.drifting,
        });
      }
    });
  }
  // Tokens and markers sharing a point are spread out so none hides another.
  const occupants = [
    ...placed.map((t) => ({ key: `${t.seat}:${t.token}`, point: t.point })),
    ...markers.map((m) => ({ key: `m${m.seat}:${m.token}:${m.marker}`, point: m.point })),
  ];
  const groups = new Map<string, typeof occupants>();
  for (const o of occupants) {
    const k = pointKey(o.point);
    groups.set(k, [...(groups.get(k) ?? []), o]);
  }
  const position = new Map<string, Point & { scale: number }>();
  for (const g of groups.values()) {
    g.forEach((o, i) => {
      const s = spread(g.length, i);
      position.set(o.key, { x: o.point.x + s.dx, y: o.point.y + s.dy, scale: s.scale });
    });
  }

  const links = state.players.flatMap((p) => {
    if (!p.link) return [];
    const [a, b] = p.link.map((i) => position.get(`${p.seat}:${i}`));
    if (!a || !b) return [];
    return [
      <line
        key={`link-${p.seat}`}
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke={LINK_COLOR}
        strokeWidth={0.08}
        strokeLinecap="round"
        opacity={0.8}
      />,
    ];
  });

  const splitLines = state.players.flatMap((p) =>
    p.tokens.flatMap((t, i) => {
      if (!t.split) return [];
      const [a, b] = ([0, 1] as const).map((mi) => position.get(`m${p.seat}:${i}:${mi}`)!);
      return [
        <line
          key={`sl-${p.seat}-${i}`}
          x1={a!.x}
          y1={a!.y}
          x2={b!.x}
          y2={b!.y}
          stroke={SPLIT_COLOR}
          strokeWidth={0.06}
          strokeDasharray="0.15 0.12"
          opacity={0.7}
        />,
      ];
    }),
  );

  const targetFor = (seat: number, token: number, marker: MarkerIndex) =>
    markerTargets.find((m) => m.seat === seat && m.token === token && m.marker === marker);

  return (
    <svg
      viewBox={`-0.2 -0.2 ${GRID + 0.4} ${GRID + 0.4}`}
      className="h-full w-full select-none"
      role="img"
      aria-label="Quantum Ludo board"
    >
      <StaticBoard state={state} />
      {nodes}
      {/* Whose turn: a ring around their yard. */}
      <rect
        x={YARD_ORIGIN[current.color][0] + 0.05}
        y={YARD_ORIGIN[current.color][1] + 0.05}
        width={5.9}
        height={5.9}
        rx={0.55}
        fill="none"
        stroke="#f8fafc"
        strokeWidth={0.12}
        className="turn-ring"
      />
      {splitLines}
      {links}

      {markers.map((m) => {
        const target = targetFor(m.seat, m.token, m.marker);
        const pos = position.get(`m${m.seat}:${m.token}:${m.marker}`)!;
        return (
          <g
            key={`m-${m.seat}-${m.token}-${m.marker}`}
            transform={`translate(${pos.x} ${pos.y}) scale(${pos.scale})`}
            onClick={target?.onClick}
            className={target ? "cursor-pointer" : undefined}
          >
            {target && <circle r={0.48} fill="none" stroke="#f472b6" strokeWidth={0.07} className="pulse" />}
            <Token color={m.color} dashed />
            <text y={-0.42} textAnchor="middle" fontSize={0.26} fontWeight={700} fill={SPLIT_COLOR}>
              {m.marker === 0 ? "A" : "B"}
            </text>
          </g>
        );
      })}

      {placed.map((t) => {
        const pos = position.get(`${t.seat}:${t.token}`)!;
        const canTap = selectable?.seat === t.seat && selectable.tokens.has(t.token);
        const isSelected = canTap && selected === t.token;
        return (
          <g
            key={`tok-${t.seat}-${t.token}`}
            className="token"
            style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${pos.scale})` }}
            onClick={canTap ? () => onTokenClick(t.seat, t.token) : undefined}
            role={canTap ? "button" : undefined}
            aria-label={canTap ? `Token ${t.token + 1}` : undefined}
          >
            {canTap && (
              <circle
                r={0.5}
                fill="none"
                stroke="#f8fafc"
                strokeWidth={isSelected ? 0.1 : 0.06}
                className={isSelected ? undefined : "pulse"}
              />
            )}
            {t.drifting && (
              <circle r={0.47} fill="none" stroke="#e2e8f0" strokeWidth={0.05} strokeDasharray="0.1 0.08" />
            )}
            <Token color={t.color} faded={t.drifting} />
            {canTap && (
              <text
                y={0.62}
                textAnchor="middle"
                fontSize={0.24}
                fontWeight={700}
                fill="#f8fafc"
                className="token-number"
              >
                {t.token + 1}
              </text>
            )}
            {canTap && <circle r={0.6} fill="transparent" className="cursor-pointer" />}
          </g>
        );
      })}

      {previews.map((p, i) => {
        const color = p.kind === "split" ? SPLIT_COLOR : p.kind === "ghost" ? "#e2e8f0" : "#f8fafc";
        return (
          <g
            key={`pv-${i}`}
            transform={`translate(${p.point.x} ${p.point.y})`}
            onClick={p.onClick}
            className="cursor-pointer"
          >
            <circle r={0.42} fill={color} opacity={0.18} />
            <circle
              r={0.42}
              fill="none"
              stroke={color}
              strokeWidth={0.07}
              strokeDasharray="0.14 0.1"
              className="pulse"
            />
            {p.label && (
              <text y={0.11} textAnchor="middle" fontSize={0.3} fontWeight={800} fill={color}>
                {p.label}
              </text>
            )}
            <circle r={0.55} fill="transparent" />
          </g>
        );
      })}
    </svg>
  );
}
