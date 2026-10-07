import type { Mechanic } from "@qludo/engine";
import type { Weights } from "./evaluate";

export type PersonalityId = "hunter" | "racer" | "gambler" | "banker";

export interface Personality {
  id: PersonalityId;
  name: string;
  description: string;
  weights: Weights;
  /** Quantum mechanics this personality is willing to use. */
  mechanics: ReadonlySet<Mechanic>;
}

const ALL: ReadonlySet<Mechanic> = new Set(["superpose", "entangle", "ghost", "observe"]);

// Tuned 2026-10-07 against 4-player sims (1500 games per mode): win rates Banker ~28%, Hunter ~27%,
// Gambler ~25%, Racer ~20%. The Racer's ceiling is structural: it only uses Ghost.
export const PERSONALITIES: Record<PersonalityId, Personality> = {
  hunter: {
    id: "hunter",
    name: "The Hunter",
    description: "Aggressive. Chases captures and uses Observation to force bad squares.",
    weights: {
      progress: 0.8,
      enter: 10,
      home: 10,
      points: 1.6,
      danger: 0.5,
      safe: 0.8,
      q: 2,
      link: 0,
      split: 0.5,
      opponent: 0.6,
      attack: 2.2,
      leader: 0.4,
      leaderThreat: 0.6,
    },
    mechanics: ALL,
  },
  racer: {
    id: "racer",
    name: "The Racer",
    description: "Pure speed. Rushes tokens home and only spends Q on Ghost to shield a runner.",
    weights: {
      progress: 1.1,
      enter: 10,
      home: 14,
      points: 1,
      danger: 0.7,
      safe: 0.5,
      q: 1.5,
      link: 0,
      split: 0,
      opponent: 0.2,
      attack: 0,
      leader: 0.1,
      leaderThreat: 0,
    },
    mechanics: new Set(["ghost"]),
  },
  gambler: {
    id: "gambler",
    name: "The Gambler",
    description: "Quantum-heavy. Superposes often, entangles pairs and farms Nodes.",
    weights: {
      progress: 0.9,
      enter: 10,
      home: 10,
      points: 1,
      danger: 0.7,
      safe: 0.5,
      q: 2,
      link: 2.5,
      split: 1.5,
      opponent: 0.4,
      attack: 1.2,
      leader: 0.2,
      leaderThreat: 0.3,
    },
    mechanics: ALL,
  },
  banker: {
    id: "banker",
    name: "The Banker",
    description: "Defensive. Hoards Q, sits on safe squares and Nodes, and spends only on clear gains.",
    weights: {
      progress: 0.9,
      enter: 10,
      home: 10,
      points: 1,
      danger: 0.8,
      safe: 1.2,
      q: 2.8,
      link: 0.5,
      split: 0,
      opponent: 0.4,
      attack: 0.5,
      leader: 0.2,
      leaderThreat: 0.2,
    },
    mechanics: ALL,
  },
};

export const PERSONALITY_IDS = Object.keys(PERSONALITIES) as PersonalityId[];
