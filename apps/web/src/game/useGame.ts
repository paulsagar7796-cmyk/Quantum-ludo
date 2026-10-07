import { createBot, type Bot } from "@qludo/bots";
import {
  SeededRng,
  applyAction,
  createGame,
  legalActions,
  type Action,
  type GameEvent,
  type GameState,
} from "@qludo/engine";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { describe, type LogLine } from "./format";
import { seatName, type BotSpeed, type MatchConfig } from "./match";
import { clearSave, writeSave, type SavedGame } from "./save";
import { cuesFor, sfx } from "./sound";

const BOT_DELAY: Record<BotSpeed, number> = { fast: 250, normal: 650, slow: 1200, instant: 0 };
const MAX_LOG = 200;
/** How long the die tumbles before showing its value. */
export const ROLL_ANIM_MS = 520;

function reducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function randomSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0]!;
}

export interface GameController {
  state: GameState;
  legal: Action[];
  log: LogLine[];
  /** Events from the most recent action, for highlights and toasts. */
  lastEvents: GameEvent[];
  /** Last die value and who rolled it. */
  lastRoll: { seat: number; value: number; n: number } | null;
  isHumanTurn: boolean;
  /** True while the die animation plays; the result is hidden until it ends. */
  rolling: boolean;
  dispatch: (action: Action) => void;
  name: (seat: number) => string;
}

/**
 * Local (hot-seat) game. This device is the authority: it owns the RNG and runs the bots.
 * M2 will put the same engine behind a Transport so a host or server can be the authority instead.
 */
export function useGame(match: MatchConfig, resume?: SavedGame | null): GameController {
  const rng = useRef<SeededRng>(null!);
  if (!rng.current) {
    rng.current = new SeededRng(0);
    rng.current.setState(resume ? resume.rng : randomSeed());
  }

  const [state, setState] = useState(
    () => resume?.state ?? createGame({ playerCount: match.playerCount, observationMode: match.observationMode }),
  );
  const [log, setLog] = useState<LogLine[]>(() => resume?.log ?? []);
  const [lastEvents, setLastEvents] = useState<GameEvent[]>([]);
  const [lastRoll, setLastRoll] = useState<{ seat: number; value: number; n: number } | null>(() => resume?.lastRoll ?? null);
  const [rolling, setRolling] = useState(false);
  const stateRef = useRef(state);
  const nextId = useRef(resume ? Math.max(0, ...resume.log.map((l) => l.id + 1)) : 0);
  const rollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (rollTimer.current && clearTimeout(rollTimer.current)), []);

  const bots = useMemo<(Bot | null)[]>(
    () => match.seats.slice(0, match.playerCount).map((s, i) => (s.kind === "bot" ? createBot(s.bot, i + 1) : null)),
    [match],
  );
  const name = useCallback((seat: number) => seatName(match, seat), [match]);
  const humanSeats = useMemo(
    () => new Set(match.seats.slice(0, match.playerCount).flatMap((s, i) => (s.kind === "human" ? [i] : []))),
    [match],
  );

  const dispatch = useCallback(
    (action: Action) => {
      const res = applyAction(stateRef.current, action, rng.current);
      stateRef.current = res.state;
      setState(res.state);
      setLastEvents(res.events);
      const lines: LogLine[] = [];
      for (const e of res.events) {
        const d = describe(e, name);
        if (d) lines.push({ id: nextId.current++, ...d });
      }
      const appendLog = () => lines.length && setLog((prev) => [...lines.reverse(), ...prev].slice(0, MAX_LOG));

      const roll = res.events.find((e) => e.type === "rolled");
      const animate = roll && match.botSpeed !== "instant" && !reducedMotion();
      if (roll && roll.type === "rolled") setLastRoll((prev) => ({ seat: roll.seat, value: roll.value, n: (prev?.n ?? 0) + 1 }));
      if (animate) {
        // Keep the result (and its log line) hidden until the die lands.
        setRolling(true);
        if (rollTimer.current) clearTimeout(rollTimer.current);
        rollTimer.current = setTimeout(() => {
          setRolling(false);
          appendLog();
        }, ROLL_ANIM_MS);
      } else {
        appendLog();
      }
      sfx.playCues(cuesFor(res.events, humanSeats));
    },
    [name, humanSeats, match.botSpeed],
  );

  // Save after every change so the game survives a refresh; a finished game is not resumable.
  useEffect(() => {
    if (state.phase === "over") clearSave();
    else writeSave({ match, state, rng: rng.current.getState(), log, lastRoll });
  }, [match, state, log, lastRoll]);

  const bot = state.phase === "over" ? null : bots[state.current];
  useEffect(() => {
    if (!bot || rolling) return;
    const delay = BOT_DELAY[match.botSpeed] * (state.phase === "upkeep" ? 0.8 : 1);
    const t = setTimeout(() => dispatch(bot.choose(stateRef.current)), delay);
    return () => clearTimeout(t);
  }, [bot, state, rolling, dispatch, match.botSpeed]);

  const legal = useMemo(() => legalActions(state), [state]);
  return { state, legal, log, lastEvents, lastRoll, isHumanTurn: state.phase !== "over" && !bot, rolling, dispatch, name };
}
