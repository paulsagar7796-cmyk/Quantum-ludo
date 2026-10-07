import { COLORS, START_SQUARE, STAR_SQUARES } from "@qludo/engine";
import { describe, expect, it } from "vitest";
import { GRID, HOME_COLUMN, TRACK, pointFor, trackCell } from "./layout";

describe("board layout", () => {
  it("has 52 distinct track cells inside the grid", () => {
    expect(TRACK).toHaveLength(52);
    expect(new Set(TRACK.map((c) => c.join(","))).size).toBe(52);
    for (const [x, y] of TRACK) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(GRID);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(GRID);
    }
  });

  it("moves to a neighbouring cell each square, turning the 4 inner corners diagonally", () => {
    let diagonals = 0;
    for (let i = 0; i < TRACK.length; i++) {
      const [ax, ay] = TRACK[i]!;
      const [bx, by] = TRACK[(i + 1) % TRACK.length]!;
      const [dx, dy] = [Math.abs(ax - bx), Math.abs(ay - by)];
      expect(Math.max(dx, dy)).toBe(1);
      if (dx + dy === 2) diagonals++;
    }
    expect(diagonals).toBe(4);
  });

  it("puts start squares and stars on the classic cells", () => {
    expect(TRACK[START_SQUARE.red]).toEqual([1, 6]);
    expect(TRACK[START_SQUARE.green]).toEqual([8, 1]);
    expect(TRACK[START_SQUARE.yellow]).toEqual([13, 8]);
    expect(TRACK[START_SQUARE.blue]).toEqual([6, 13]);
    expect(STAR_SQUARES.map((s) => TRACK[s])).toEqual([
      [6, 2],
      [12, 6],
      [8, 12],
      [2, 8],
    ]);
  });

  it("enters each home column from the square next to it", () => {
    for (const color of COLORS) {
      const [lx, ly] = trackCell(color, 50);
      const [hx, hy] = HOME_COLUMN[color][0]!;
      expect(Math.abs(lx - hx) + Math.abs(ly - hy)).toBe(1);
    }
  });

  it("gives every token a distinct yard slot and home spot", () => {
    for (const color of COLORS) {
      for (const pos of [-1, 56]) {
        const pts = [0, 1, 2, 3].map((t) => pointFor(color, pos, t));
        expect(new Set(pts.map((p) => `${p.x},${p.y}`)).size).toBe(4);
      }
    }
  });
});
