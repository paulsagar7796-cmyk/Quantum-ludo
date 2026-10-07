import type { BotId } from "@qludo/bots";
import type { EndCondition, ObservationMode, PlayerCount } from "@qludo/engine";
import { runSimulation, type SimReport } from "./index";

/**
 * Usage: pnpm sim -- --games=500 --players=4 --mode=both --end=firstFinisher --seed=1 --lineup=hunter,racer
 */
function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const arg of argv) {
    const m = /^--([^=]+)=(.*)$/.exec(arg);
    if (m) out[m[1]!] = m[2]!;
  }
  return out;
}

const pct = (n: number, d: number) => (d === 0 ? "-" : `${((100 * n) / d).toFixed(1)}%`);
const avg = (n: number, d: number, digits = 2) => (d === 0 ? "-" : (n / d).toFixed(digits));

function table(rows: (string | number)[][]): string {
  const widths = rows[0]!.map((_, c) => Math.max(...rows.map((r) => String(r[c]).length)));
  return rows.map((r) => r.map((cell, c) => String(cell).padEnd(widths[c]!)).join("  ")).join("\n");
}

function print(r: SimReport): void {
  const o = r.options;
  const sorted = [...r.rounds].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  console.log(
    `\n=== ${o.playerCount} players | ${o.mode === "coin" ? "Chaos (coin)" : "Tactical (choice)"} | end: ${o.endCondition} | ${r.games} games | ${(r.ms / 1000).toFixed(1)}s ===`,
  );
  console.log(
    `Rounds: mean ${avg(
      r.rounds.reduce((a, b) => a + b, 0),
      r.rounds.length,
      1,
    )}, median ${median} | ` +
      `ended by finish ${pct(r.finishEnds, r.games)}, by round cap ${pct(r.roundCapEnds, r.games)} | ` +
      `marker hits ${avg(r.hits, r.games)}/game (${pct(r.hitSuccesses, r.hits)} captured) | forfeits ${avg(r.forfeits, r.games)}/game`,
  );
  console.log(`Seat wins: ${r.seatWins.map((w, i) => `seat ${i} ${pct(w, r.games)}`).join(", ")}`);

  const rows: (string | number)[][] = [
    [
      "bot",
      "games",
      "win%",
      "avgPlace",
      "avgScore",
      "home/g",
      "capt/g",
      "lost/g",
      "Q node/g",
      "Q capt/g",
      "split/g",
      "link/g",
      "ghost/g",
      "force/g",
      "endQ",
    ],
  ];
  for (const [id, s] of Object.entries(r.bots)) {
    rows.push([
      id,
      s.seats,
      pct(s.wins, s.seats),
      avg(s.placeSum, s.seats),
      avg(s.totalScore, s.seats, 1),
      avg(s.tokensHome, s.seats),
      avg(s.captures, s.seats),
      avg(s.timesCaptured, s.seats),
      avg(s.qNode, s.seats),
      avg(s.qCaptured, s.seats),
      avg(s.spent.superpose, s.seats),
      avg(s.spent.entangle, s.seats),
      avg(s.spent.ghost, s.seats),
      avg(s.forces, s.seats),
      avg(s.freeForces, s.seats),
      avg(s.endQ, s.seats),
    ]);
  }
  console.log(table(rows));
}

const args = parseArgs(process.argv.slice(2));
const games = Number(args.games ?? 400);
const seed = Number(args.seed ?? 1);
const endCondition = (args.end ?? "firstFinisher") as EndCondition;
const players = (args.players ?? "4").split(",").map((n) => Number(n) as PlayerCount);
const modes: ObservationMode[] = args.mode === "coin" || args.mode === "choice" ? [args.mode] : ["coin", "choice"];
const lineup = args.lineup ? (args.lineup.split(",") as BotId[]) : undefined;
const roundCap = args.roundCap ? Number(args.roundCap) : undefined;

for (const playerCount of players) {
  for (const mode of modes) {
    print(
      runSimulation({
        games,
        playerCount,
        mode,
        endCondition,
        seed,
        ...(lineup ? { lineup } : {}),
        ...(roundCap ? { rules: { roundCap } } : {}),
      }),
    );
  }
}
