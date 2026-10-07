import { PERSONALITY_IDS, createBot, type Bot, type BotId } from "@qludo/bots";
import {
  SeededRng,
  applyAction,
  createGame,
  type EndCondition,
  type GameEvent,
  type GameState,
  type Mechanic,
  type ObservationMode,
  type PlayerCount,
  type Rules,
} from "@qludo/engine";

export interface SimOptions {
  games: number;
  playerCount: PlayerCount;
  mode: ObservationMode;
  endCondition: EndCondition;
  seed: number;
  /** Bots to seat. Defaults to the four personalities. Seats rotate every game. */
  lineup?: BotId[];
  rules?: Partial<Rules>;
}

export interface BotStats {
  seats: number;
  wins: number;
  totalScore: number;
  placeSum: number;
  captures: number;
  timesCaptured: number;
  qNode: number;
  qCaptured: number;
  spent: Record<Mechanic, number>;
  endQ: number;
  tokensHome: number;
  /** Every Force used, and how many of those were free (aimed at the race leader). */
  forces: number;
  freeForces: number;
}

export interface SimReport {
  options: SimOptions;
  games: number;
  bots: Record<string, BotStats>;
  seatWins: number[];
  rounds: number[];
  roundCapEnds: number;
  finishEnds: number;
  hits: number;
  hitSuccesses: number;
  forfeits: number;
  ms: number;
}

const emptyStats = (): BotStats => ({
  seats: 0,
  wins: 0,
  totalScore: 0,
  placeSum: 0,
  captures: 0,
  timesCaptured: 0,
  qNode: 0,
  qCaptured: 0,
  spent: { superpose: 0, entangle: 0, ghost: 0, observe: 0 },
  endQ: 0,
  tokensHome: 0,
  forces: 0,
  freeForces: 0,
});

/** Pick the bots for game `g`: rotate the lineup so every bot plays every seat. */
function seatBots(pool: BotId[], playerCount: number, g: number, rng: SeededRng): BotId[] {
  let chosen = pool;
  if (pool.length > playerCount) {
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    chosen = shuffled.slice(0, playerCount);
  }
  return Array.from({ length: playerCount }, (_, i) => chosen[(i + g) % chosen.length]!);
}

export function playGame(
  state: GameState,
  bots: Bot[],
  rng: SeededRng,
  onEvents?: (events: GameEvent[]) => void,
): GameState {
  let s = state;
  let steps = 0;
  while (s.phase !== "over") {
    const action = bots[s.current]!.choose(s);
    const res = applyAction(s, action, rng, { trusted: true });
    onEvents?.(res.events);
    s = res.state;
    if (++steps > 50_000) throw new Error("Game did not terminate");
  }
  return s;
}

export function runSimulation(opts: SimOptions): SimReport {
  const started = performance.now();
  const pool = opts.lineup ?? [...PERSONALITY_IDS];
  const lineupRng = new SeededRng(opts.seed ^ 0x5bd1e995);
  const report: SimReport = {
    options: opts,
    games: opts.games,
    bots: {},
    seatWins: Array.from({ length: opts.playerCount }, () => 0),
    rounds: [],
    roundCapEnds: 0,
    finishEnds: 0,
    hits: 0,
    hitSuccesses: 0,
    forfeits: 0,
    ms: 0,
  };

  for (let g = 0; g < opts.games; g++) {
    const ids = seatBots(pool, opts.playerCount, g, lineupRng);
    const bots = ids.map((id, i) => createBot(id, opts.seed * 7919 + g * 31 + i));
    const statsFor = (seat: number) => (report.bots[ids[seat]!] ??= emptyStats());

    const initial = createGame({
      playerCount: opts.playerCount,
      observationMode: opts.mode,
      endCondition: opts.endCondition,
      ...(opts.rules ? { rules: opts.rules } : {}),
    });

    const final = playGame(initial, bots, new SeededRng(opts.seed * 1_000_003 + g), (events) => {
      for (const e of events) {
        switch (e.type) {
          case "captured":
            statsFor(e.seat).captures++;
            statsFor(e.victim.seat).timesCaptured++;
            break;
          case "qGained":
            if (e.reason === "node") statsFor(e.seat).qNode++;
            else statsFor(e.seat).qCaptured++;
            break;
          case "qSpent":
            statsFor(e.seat).spent[e.mechanic]++;
            break;
          case "observed":
            statsFor(e.seat).forces++;
            if (e.free) statsFor(e.seat).freeForces++;
            break;
          case "hit":
            report.hits++;
            if (e.success) report.hitSuccesses++;
            break;
          case "forfeit":
            report.forfeits++;
            break;
        }
      }
    });

    const result = final.result!;
    report.rounds.push(result.rounds);
    if (result.reason === "roundCap") report.roundCapEnds++;
    else report.finishEnds++;
    report.seatWins[result.ranking[0]!]!++;

    result.ranking.forEach((seat, place) => {
      const st = statsFor(seat);
      st.seats++;
      st.placeSum += place + 1;
      st.totalScore += result.scores[seat]!.total;
      st.endQ += final.players[seat]!.q;
      st.tokensHome += final.players[seat]!.tokens.filter((t) => t.pos === 56).length;
      if (place === 0) st.wins++;
    });
  }

  report.ms = performance.now() - started;
  return report;
}
