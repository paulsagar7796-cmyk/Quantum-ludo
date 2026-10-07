import { HOME_POS, LAST_TRACK_POS, START_SQUARE, TRACK_LENGTH, YARD, type Color } from "@qludo/engine";

/** Board is a 15×15 grid. Cells are addressed by their top-left corner; points are cell centres. */
export const GRID = 15;

export type Cell = readonly [x: number, y: number];
export interface Point {
  x: number;
  y: number;
}

function run(from: Cell, dx: number, dy: number, n: number): Cell[] {
  return Array.from({ length: n }, (_, i) => [from[0] + dx * i, from[1] + dy * i] as const);
}

/**
 * The 52 shared squares, clockwise, starting at red's start square on the left arm.
 * Start squares land on 0 (red), 13 (green), 26 (yellow), 39 (blue) to match the engine.
 */
export const TRACK: readonly Cell[] = [
  ...run([1, 6], 1, 0, 5), // 0–4   left arm, top row, heading right
  ...run([6, 5], 0, -1, 6), // 5–10  top arm, left column, heading up
  [7, 0], // 11
  ...run([8, 0], 0, 1, 6), // 12–17 top arm, right column, heading down
  ...run([9, 6], 1, 0, 6), // 18–23 right arm, top row, heading right
  [14, 7], // 24
  ...run([14, 8], -1, 0, 6), // 25–30 right arm, bottom row, heading left
  ...run([8, 9], 0, 1, 6), // 31–36 bottom arm, right column, heading down
  [7, 14], // 37
  ...run([6, 14], 0, -1, 6), // 38–43 bottom arm, left column, heading up
  ...run([5, 8], -1, 0, 6), // 44–49 left arm, bottom row, heading left
  [0, 7], // 50
  [0, 6], // 51
];

/** Private home columns, relative positions 51–55. */
export const HOME_COLUMN: Record<Color, readonly Cell[]> = {
  red: run([1, 7], 1, 0, 5),
  green: run([7, 1], 0, 1, 5),
  yellow: run([13, 7], -1, 0, 5),
  blue: run([7, 13], 0, -1, 5),
};

/** Yard corner (top-left cell of the 6×6 block). */
export const YARD_ORIGIN: Record<Color, Cell> = {
  red: [0, 0],
  green: [9, 0],
  yellow: [9, 9],
  blue: [0, 9],
};

const YARD_SLOT_OFFSETS: readonly Cell[] = [
  [2, 2],
  [4, 2],
  [2, 4],
  [4, 4],
];

/** Where finished tokens gather, inside their colour's centre triangle. */
const HOME_ANCHOR: Record<Color, Point> = {
  red: { x: 6.6, y: 7.5 },
  green: { x: 7.5, y: 6.6 },
  yellow: { x: 8.4, y: 7.5 },
  blue: { x: 7.5, y: 8.4 },
};

export const centre = (c: Cell): Point => ({ x: c[0] + 0.5, y: c[1] + 0.5 });

export function trackCell(color: Color, pos: number): Cell {
  return TRACK[(START_SQUARE[color] + pos) % TRACK_LENGTH]!;
}

/** Board point for a token at a relative position. `token` picks the yard slot / home spot. */
export function pointFor(color: Color, pos: number, token: number): Point {
  if (pos === YARD) {
    const o = YARD_ORIGIN[color];
    const s = YARD_SLOT_OFFSETS[token]!;
    return { x: o[0] + s[0], y: o[1] + s[1] };
  }
  if (pos <= LAST_TRACK_POS) return centre(trackCell(color, pos));
  if (pos < HOME_POS) return centre(HOME_COLUMN[color][pos - LAST_TRACK_POS - 1]!);
  const a = HOME_ANCHOR[color];
  const spread = [-0.3, 0.3];
  const horizontal = color === "green" || color === "blue";
  const offset = spread[token % 2]!;
  const depth = token < 2 ? 0 : color === "red" || color === "green" ? -0.35 : 0.35;
  return horizontal ? { x: a.x + offset, y: a.y + depth } : { x: a.x + depth, y: a.y + offset };
}

/** Key for grouping tokens that share a cell. */
export const pointKey = (p: Point) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
