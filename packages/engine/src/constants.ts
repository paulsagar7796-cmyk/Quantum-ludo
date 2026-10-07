import type { Color, Rules } from "./types";

/** Squares on the shared loop. */
export const TRACK_LENGTH = 52;
/** Last relative position on the shared track. 51–55 is the private home column. */
export const LAST_TRACK_POS = 50;
export const HOME_COLUMN_START = 51;
/** Relative position of a token that has reached home. */
export const HOME_POS = 56;
/** Relative position of a token in the yard. */
export const YARD = -1;
export const TOKENS_PER_PLAYER = 4;
/** Distance a token moves when it leaves the yard. */
export const ENTRY_ROLL = 6;

export const COLORS = ["red", "green", "yellow", "blue"] as const;

/** Absolute index of each colour's start square on the shared loop. */
export const START_SQUARE: Record<Color, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

/** Star squares, 8 squares ahead of each start square. */
export const STAR_SQUARES: readonly number[] = [8, 21, 34, 47];

/** Safe squares are the 4 start squares and the 4 stars. They are also the Quantum Nodes. */
export const SAFE_SQUARES: ReadonlySet<number> = new Set([0, 13, 26, 39, ...STAR_SQUARES]);
export const NODE_SQUARES: ReadonlySet<number> = SAFE_SQUARES;

/** Colours used for each player count. Two players sit opposite each other. */
export const SEAT_COLORS: Record<2 | 3 | 4, readonly Color[]> = {
  2: ["red", "yellow"],
  3: ["red", "green", "yellow"],
  4: ["red", "green", "yellow", "blue"],
};

/** Every tunable number lives here so balance changes touch one object. */
export const DEFAULT_RULES: Rules = {
  startQ: 1,
  maxQ: 4,
  /**
   * Mercy cap. Games normally end when the first player gets all 4 tokens home.
   * 90 still ended ~14% of 4-player sim games, 120 ends <0.5%, so 120 it is.
   */
  roundCap: 120,
  maxConsecutiveSixes: 3,
  knockback: 6,
  points: {
    home: 10,
    capture: 3,
    captureSplit: 4,
    captured: -1,
  },
  squaresPerProgressPoint: 5,
  unspentQCap: 2,
  splitMaxTurns: 2,
  freeForceOnLeader: true,
  finishBonus: [15, 8, 4],
};
