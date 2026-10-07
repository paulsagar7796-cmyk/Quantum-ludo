import type { Rng } from "./types";

/**
 * Seeded mulberry32 generator. Its whole state is one 32-bit number, so the
 * authority (host device or server) can persist it with `getState`/`setState`.
 */
export class SeededRng implements Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  getState(): number {
    return this.state;
  }

  setState(state: number): void {
    this.state = state >>> 0;
  }
}

export function rollDie(rng: Rng): number {
  return 1 + Math.floor(rng.next() * 6);
}

/** True = heads. Heads always means "the first option" to the caller. */
export function flipCoin(rng: Rng): boolean {
  return rng.next() < 0.5;
}
