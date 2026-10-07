import type { GameEvent } from "@qludo/engine";

export type Tone = "neutral" | "good" | "bad" | "quantum";

export interface LogLine {
  id: number;
  seat: number | null;
  text: string;
  tone: Tone;
}

/** Turns an engine event into a short sentence for the move log, or null to skip it. */
export function describe(e: GameEvent, name: (seat: number) => string): { seat: number | null; text: string; tone: Tone } | null {
  // "You" needs its own grammar: "You have", "Your token".
  const has = (seat: number) => (name(seat) === "You" ? "have" : "has");
  const poss = (seat: number) => (name(seat) === "You" ? "Your" : `${name(seat)}'s`);
  switch (e.type) {
    case "rolled":
      return { seat: e.seat, text: `${name(e.seat)} rolled a ${e.value}`, tone: "neutral" };
    case "forfeit":
      return { seat: e.seat, text: `${name(e.seat)} rolled a third 6 and ${name(e.seat) === "You" ? "lose" : "loses"} the turn`, tone: "bad" };
    case "entered":
      return { seat: e.seat, text: `${name(e.seat)} brought a token out`, tone: "neutral" };
    case "captured":
      return {
        seat: e.seat,
        text: e.wasSplit ? `${name(e.seat)} captured ${poss(e.victim.seat).replace(/^Your$/, "your")} split token` : `${name(e.seat)} captured ${name(e.victim.seat) === "You" ? "you" : name(e.victim.seat)}`,
        tone: "good",
      };
    case "hit":
      return {
        seat: e.seat,
        text: `${name(e.seat)} hit a marker: coin says ${e.success ? "it was there!" : "it wasn't there"}`,
        tone: "quantum",
      };
    case "superposed":
      return { seat: e.seat, text: `${name(e.seat)} used Split`, tone: "quantum" };
    case "held":
      return { seat: e.seat, text: `${name(e.seat)} held ${name(e.seat) === "You" ? "your" : "their"} Split open`, tone: "quantum" };
    case "collapsed":
      if (e.cause === "owner") return { seat: e.seat, text: `${name(e.seat)} collapsed ${name(e.seat) === "You" ? "your" : "their"} Split`, tone: "quantum" };
      if (e.cause === "observe") return { seat: e.seat, text: `${poss(e.seat)} Split was forced to collapse`, tone: "quantum" };
      return { seat: e.seat, text: `${poss(e.seat)} token survives on its other marker`, tone: "quantum" };
    case "observed":
      return { seat: e.seat, text: `${name(e.seat)} used Force on ${name(e.target.seat) === "You" ? "you" : name(e.target.seat)}`, tone: "quantum" };
    case "entangled":
      return { seat: e.seat, text: `${name(e.seat)} linked two tokens`, tone: "quantum" };
    case "decoupled":
      return e.reason === "choice"
        ? { seat: e.seat, text: `${name(e.seat)} broke ${name(e.seat) === "You" ? "your" : "their"} Link`, tone: "neutral" }
        : null;
    case "knockback":
      return { seat: e.seat, text: `${poss(e.seat)} linked partner was knocked back ${e.from - e.to}`, tone: "bad" };
    case "moved":
      return e.via === "ghost" ? { seat: e.seat, text: `${name(e.seat)} used Ghost`, tone: "quantum" } : null;
    case "solidified":
      return null;
    case "qGained":
      return {
        seat: e.seat,
        text: e.reason === "node" ? `${name(e.seat)} harvested a Node (+1 Q)` : `${name(e.seat)} ${name(e.seat) === "You" ? "get" : "gets"} +1 Q to recover`,
        tone: "good",
      };
    case "qSpent":
      return null;
    case "tokenHome":
      return { seat: e.seat, text: `${name(e.seat)} got a token home (+10)`, tone: "good" };
    case "playerFinished":
      return { seat: e.seat, text: `${name(e.seat)} ${has(e.seat)} all four tokens home!`, tone: "good" };
    case "passed":
      return { seat: e.seat, text: `${name(e.seat)} ${has(e.seat)} no move`, tone: "neutral" };
    case "gameOver":
      return { seat: null, text: e.result.reason === "finish" ? "Game over" : "Game over: mercy cap reached", tone: "neutral" };
    case "turnStart":
      return null;
  }
}
