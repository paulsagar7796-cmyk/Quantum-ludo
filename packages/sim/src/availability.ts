// Analysis: how often each quantum action is on offer, and how often bots take it.
// Usage: pnpm --filter @qludo/sim run availability -- coin|choice
import { PERSONALITY_IDS, createBot } from "@qludo/bots";
import { SeededRng, applyAction, createGame, legalActions } from "@qludo/engine";

const mode = (process.argv[2] ?? "coin") as "coin" | "choice";
let actTurns = 0;
const offered: Record<string, number> = { ghost: 0, superpose: 0, entangle: 0, observe: 0, hold: 0 };
const taken: Record<string, number> = { ghost: 0, superpose: 0, entangle: 0, observe: 0, hold: 0 };
for (let g = 0; g < 300; g++) {
  const bots = PERSONALITY_IDS.map((id) => createBot(id));
  const rng = new SeededRng(g + 1);
  let s = createGame({ playerCount: 4, observationMode: mode, rules: { roundCap: 1000 } });
  while (s.phase !== "over") {
    const legal = legalActions(s);
    if (s.phase === "act") actTurns++;
    for (const k of Object.keys(offered)) if (legal.some((a) => a.type === k)) offered[k]!++;
    const a = bots[s.current]!.choose(s);
    if (a.type in taken) taken[a.type]!++;
    s = applyAction(s, a, rng, { trusted: true }).state;
  }
}
console.log(`mode=${mode} act phases: ${actTurns}`);
for (const k of Object.keys(offered)) {
  console.log(`${k.padEnd(10)} offered ${offered[k]} times (${((100 * offered[k]!) / actTurns).toFixed(2)}% of rolls), taken ${taken[k]} times (${((100 * taken[k]!) / Math.max(offered[k]!, 1)).toFixed(1)}% of offers)`);
}
