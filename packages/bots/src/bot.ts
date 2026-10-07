import {
  SeededRng,
  applyAction,
  currentPlayer,
  legalActions,
  type Action,
  type GameState,
  type Mechanic,
  type Rng,
} from "@qludo/engine";
import { evaluate } from "./evaluate";
import { PERSONALITIES, type Personality, type PersonalityId } from "./personalities";

export type BotId = PersonalityId | "random";

export interface Bot {
  id: BotId;
  name: string;
  choose(state: GameState): Action;
}

const MECHANIC_OF: Partial<Record<Action["type"], Mechanic>> = {
  superpose: "superpose",
  entangle: "entangle",
  ghost: "ghost",
  observe: "observe",
};

/** Fixed-value RNG used to look at both sides of a coin flip. Counts how often it was asked. */
class Probe implements Rng {
  calls = 0;
  constructor(private readonly value: number) {}
  next(): number {
    this.calls++;
    return this.value;
  }
}

/** Free actions (Entangle, Chaos Observe) leave the player in the act phase, so we look one action deeper. */
const MAX_DEPTH = 2;

function outcomeValue(state: GameState, seat: number, p: Personality, depth: number): number {
  if (depth > 0 && state.phase === "act" && currentPlayer(state).seat === seat) {
    return Math.max(...allowed(legalActions(state), p).map((a) => expectedValue(state, a, seat, p, depth - 1)));
  }
  return evaluate(state, seat, p.weights);
}

/** Value of an action averaged over its coin flips (heads-all vs tails-all). */
function expectedValue(state: GameState, action: Action, seat: number, p: Personality, depth: number): number {
  if (action.type === "roll") return evaluate(state, seat, p.weights);
  const heads = new Probe(0.25);
  const h = outcomeValue(applyAction(state, action, heads, { trusted: true }).state, seat, p, depth);
  if (heads.calls === 0) return h;
  const t = outcomeValue(applyAction(state, action, new Probe(0.75), { trusted: true }).state, seat, p, depth);
  return (h + t) / 2;
}

function allowed(actions: Action[], p: Personality): Action[] {
  const ok = actions.filter((a) => {
    const m = MECHANIC_OF[a.type];
    return m === undefined || p.mechanics.has(m);
  });
  return ok.length > 0 ? ok : actions;
}

export function createPersonalityBot(id: PersonalityId): Bot {
  const p = PERSONALITIES[id];
  return {
    id,
    name: p.name,
    choose(state) {
      const seat = currentPlayer(state).seat;
      const options = allowed(legalActions(state), p);
      if (options.length === 1) return options[0]!;
      let best = options[0]!;
      let bestValue = -Infinity;
      for (const a of options) {
        const v = expectedValue(state, a, seat, p, MAX_DEPTH);
        if (v > bestValue + 1e-9) {
          best = a;
          bestValue = v;
        }
      }
      return best;
    },
  };
}

/** Baseline that picks any legal action at random. Used for sanity checks. */
export function createRandomBot(seed: number): Bot {
  const rng = new SeededRng(seed);
  return {
    id: "random",
    name: "Random",
    choose(state) {
      const options = legalActions(state);
      return options[Math.floor(rng.next() * options.length)]!;
    },
  };
}

export function createBot(id: BotId, seed = 1): Bot {
  return id === "random" ? createRandomBot(seed) : createPersonalityBot(id);
}
