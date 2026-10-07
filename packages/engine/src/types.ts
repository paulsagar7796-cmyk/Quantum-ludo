import type { COLORS } from "./constants";

export type Color = (typeof COLORS)[number];

/** "coin" = Chaos mode, "choice" = Tactical mode. */
export type ObservationMode = "coin" | "choice";

/** When the game ends (besides the round cap). */
export type EndCondition = "firstFinisher" | "allButOne";

export type PlayerCount = 2 | 3 | 4;

export type MarkerIndex = 0 | 1;

export interface Rules {
  startQ: number;
  maxQ: number;
  roundCap: number;
  /** The Nth consecutive 6 in one turn is forfeited. */
  maxConsecutiveSixes: number;
  knockback: number;
  points: {
    home: number;
    capture: number;
    captureSplit: number;
    captured: number;
  };
  squaresPerProgressPoint: number;
  unspentQCap: number;
  /** Owner turns a superposition may stay open: 1 = must collapse at the next turn, 2 = may hold once. */
  splitMaxTurns: number;
  /** Force costs no Q when its target belongs to the current race leader (a catch-up tool). */
  freeForceOnLeader: boolean;
  /** Bonus by finishing place: index 0 = first player to get all tokens home. */
  finishBonus: number[];
}

export interface GameConfig {
  playerCount: PlayerCount;
  observationMode: ObservationMode;
  endCondition: EndCondition;
  rules: Rules;
}

export interface TokenState {
  /** -1 = yard, 0–50 shared track, 51–55 home column, 56 = home. While split, the square it split from. */
  pos: number;
  /** Relative positions of the two superposition markers, or null when the token is real. */
  split: [number, number] | null;
  /**
   * Ghost drift: until its owner's next turn the token cannot be captured, hit or knocked back,
   * but it cannot capture, does not form blockades and cannot enter the home column.
   */
  drifting: boolean;
}

export interface ScoreTally {
  home: number;
  captures: number;
  captured: number;
}

export interface PlayerState {
  seat: number;
  color: Color;
  tokens: TokenState[];
  q: number;
  /** Indices of the two entangled tokens. */
  link: [number, number] | null;
  /** Times the current superposition has been held open past an owner turn start. */
  splitHolds: number;
  score: ScoreTally;
  finished: boolean;
}

/**
 * upkeep: start of a turn (or a bonus roll). Collapse, decouple, roll.
 * act:    a roll is pending. Move or use a quantum action.
 * over:   the game has ended. See `result`.
 */
export type Phase = "upkeep" | "act" | "over";

export interface TurnFlags {
  entangled: boolean;
  observed: boolean;
  /** The player chose to hold their superposition open this turn. */
  held: boolean;
}

export interface GameState {
  config: GameConfig;
  players: PlayerState[];
  /** Index into `players` of the player whose turn it is. */
  current: number;
  phase: Phase;
  roll: number | null;
  sixStreak: number;
  /** True when the upkeep phase is a bonus roll, not the start of a turn. */
  bonus: boolean;
  round: number;
  turn: number;
  /** Absolute node square -> round in which it last paid out. */
  nodeHarvestRound: Record<number, number>;
  flags: TurnFlags;
  /** Seats in the order they got all tokens home. */
  finishOrder: number[];
  result: GameResult | null;
}

export interface TokenRef {
  seat: number;
  token: number;
}

export type Action =
  | { type: "roll" }
  | { type: "collapse"; marker: MarkerIndex }
  | { type: "hold" }
  | { type: "decouple" }
  | { type: "move"; token: number }
  | { type: "ghost"; token: number }
  | { type: "superpose"; token: number }
  | { type: "entangle"; tokens: [number, number] }
  | { type: "observe"; target: TokenRef; marker?: MarkerIndex }
  | { type: "pass" };

export type Mechanic = "superpose" | "entangle" | "ghost" | "observe";

export type CollapseCause = "owner" | "observe" | "hit";

export type GameEvent =
  | { type: "turnStart"; seat: number; round: number; bonus: boolean }
  | { type: "rolled"; seat: number; value: number }
  | { type: "forfeit"; seat: number }
  | { type: "entered"; seat: number; token: number }
  | { type: "moved"; seat: number; token: number; from: number; to: number; via: "move" | "ghost" | "link" }
  | { type: "solidified"; seat: number; token: number }
  | { type: "captured"; seat: number; victim: TokenRef; square: number; wasSplit: boolean }
  | { type: "hit"; seat: number; victim: TokenRef; marker: MarkerIndex; success: boolean }
  | { type: "superposed"; seat: number; token: number; markers: [number, number] }
  | { type: "held"; seat: number; token: number; turnsLeft: number }
  | { type: "collapsed"; seat: number; token: number; to: number; cause: CollapseCause }
  | { type: "observed"; seat: number; target: TokenRef; mode: ObservationMode; free: boolean }
  | { type: "entangled"; seat: number; tokens: [number, number] }
  | { type: "decoupled"; seat: number; reason: "choice" | "homeColumn" | "capture" }
  | { type: "knockback"; seat: number; token: number; from: number; to: number }
  | { type: "qGained"; seat: number; amount: number; reason: "node" | "captured"; square?: number }
  | { type: "qSpent"; seat: number; mechanic: Mechanic }
  | { type: "tokenHome"; seat: number; token: number }
  | { type: "playerFinished"; seat: number; place: number }
  | { type: "passed"; seat: number }
  | { type: "gameOver"; result: GameResult };

export interface FinalScore {
  seat: number;
  home: number;
  captures: number;
  captured: number;
  progress: number;
  finishBonus: number;
  unspentQ: number;
  total: number;
}

export interface GameResult {
  reason: "finish" | "roundCap";
  rounds: number;
  /** Indexed by seat. */
  scores: FinalScore[];
  /**
   * Placement, best first: players who got all tokens home (in order), then everyone else
   * by tokens home, then by distance to home (shorter first). Finish bonuses follow this order.
   */
  ranking: number[];
}

/** Source of randomness. Must return a float in [0, 1). */
export interface Rng {
  next(): number;
}

export interface ApplyResult {
  state: GameState;
  events: GameEvent[];
}
