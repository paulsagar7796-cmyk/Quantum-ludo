import { createBot, type Bot } from "@qludo/bots";
import {
  SeededRng,
  applyAction,
  createGame,
  isLegal,
  legalActions,
  type Action,
  type GameEvent,
  type GameState,
} from "@qludo/engine";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameController, SeatKind } from "./controller";
import { seatName, type BotSpeed, type MatchConfig } from "./match";
import { clearSave, writeSave, type SavedGame } from "./save";
import { usePresentation } from "./usePresentation";

const BOT_DELAY: Record<BotSpeed, number> = { fast: 250, normal: 650, slow: 1200, instant: 0 };

function randomSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0]!;
}

export interface AuthorityOptions {
  /** Called after every applied action (the host broadcasts it). */
  onApplied?: (state: GameState, events: GameEvent[]) => void;
  /** Remote seats that are not connected. */
  offline?: ReadonlySet<number>;
  notice?: string | null;
}

export interface AuthorityController extends GameController {
  /** Apply an action from a remote seat. Ignored (returns false) unless it is that seat's turn and the action is legal. */
  applyRemote: (seat: number, action: Action) => boolean;
  /** Latest state, readable outside render (for welcoming late joiners). */
  stateRef: { readonly current: GameState };
}

/**
 * This device is the authority: it owns the RNG, applies every action, and runs the bots.
 * Used for local hot-seat games and by the host of a Wi-Fi game.
 */
export function useGame(
  match: MatchConfig,
  resume?: SavedGame | null,
  opts: AuthorityOptions = {},
): AuthorityController {
  const { onApplied } = opts;
  // Created once; the generator object itself is stable and mutated by the engine.
  const [rng] = useState(() => {
    const r = new SeededRng(0);
    r.setState(resume ? resume.rng : randomSeed());
    return r;
  });
  const [state, setState] = useState(
    () => resume?.state ?? createGame({ playerCount: match.playerCount, observationMode: match.observationMode }),
  );
  const stateRef = useRef(state);

  const seats = match.seats.slice(0, match.playerCount);
  const localSeats = useMemo(
    () => new Set(match.seats.slice(0, match.playerCount).flatMap((s, i) => (s.kind === "human" ? [i] : []))),
    [match],
  );
  const bots = useMemo<(Bot | null)[]>(
    () => match.seats.slice(0, match.playerCount).map((s, i) => (s.kind === "bot" ? createBot(s.bot, i + 1) : null)),
    [match],
  );
  const name = useCallback((seat: number) => seatName(match, seat), [match]);
  const seatKind = useCallback(
    (seat: number): SeatKind => {
      const k = match.seats[seat]!.kind;
      return k === "human" ? "local" : k;
    },
    [match],
  );

  const view = usePresentation({
    name,
    localSeats,
    animate: match.botSpeed !== "instant",
    initialLog: resume?.log,
    initialLastRoll: resume?.lastRoll,
  });
  const { ingest } = view;

  const apply = useCallback(
    (action: Action) => {
      const res = applyAction(stateRef.current, action, rng);
      stateRef.current = res.state;
      setState(res.state);
      ingest(res.events);
      onApplied?.(res.state, res.events);
    },
    [rng, ingest, onApplied],
  );

  const applyRemote = useCallback(
    (seat: number, action: Action) => {
      const s = stateRef.current;
      if (s.phase === "over" || s.current !== seat || !isLegal(s, action)) return false;
      apply(action);
      return true;
    },
    [apply],
  );

  // Save after every change so the game survives a refresh; a finished game is not resumable.
  useEffect(() => {
    if (state.phase === "over") clearSave();
    else writeSave({ match, state, rng: rng.getState(), log: view.log, lastRoll: view.lastRoll });
  }, [match, state, view.log, view.lastRoll, rng]);

  const bot = state.phase === "over" ? null : bots[state.current];
  const rolling = view.rolling;
  useEffect(() => {
    if (!bot || rolling) return;
    const delay = BOT_DELAY[match.botSpeed] * (state.phase === "upkeep" ? 0.8 : 1);
    const t = setTimeout(() => apply(bot.choose(stateRef.current)), delay);
    return () => clearTimeout(t);
  }, [bot, state, rolling, apply, match.botSpeed]);

  const legal = useMemo(() => legalActions(state), [state]);
  return {
    log: view.log,
    lastEvents: view.lastEvents,
    lastRoll: view.lastRoll,
    rolling,
    state,
    legal,
    isHumanTurn: state.phase !== "over" && seats[state.current]?.kind === "human",
    localSeats,
    seatKind,
    offline: opts.offline ?? new Set(),
    dispatch: apply,
    applyRemote,
    stateRef,
    name,
    notice: opts.notice ?? null,
  };
}
