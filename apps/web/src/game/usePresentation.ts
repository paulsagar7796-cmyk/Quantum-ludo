import type { GameEvent } from "@qludo/engine";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LastRoll } from "../net/protocol";
import { describe, type LogLine } from "./format";
import { cuesFor, sfx } from "./sound";

const MAX_LOG = 200;
/** How long the die tumbles before showing its value. */
export const ROLL_ANIM_MS = 520;

function reducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface Presentation {
  log: LogLine[];
  /** Events from the most recent action, for highlights and toasts. */
  lastEvents: GameEvent[];
  lastRoll: LastRoll | null;
  /** True while the die animation plays; the result is hidden until it ends. */
  rolling: boolean;
  /** Feed the events of one action: updates the log, die and sounds. */
  ingest: (events: GameEvent[]) => void;
  /** Clear the log and die, e.g. when the host starts a rematch. */
  reset: () => void;
}

/**
 * Everything a device shows about the game besides the board itself. The same on every device,
 * whether it runs the engine (local, host) or only mirrors it (guest).
 */
export function usePresentation(opts: {
  name: (seat: number) => string;
  /** Seats played on this device: they get the "your turn" ping. */
  localSeats: ReadonlySet<number>;
  animate: boolean;
  initialLog?: LogLine[];
  initialLastRoll?: LastRoll | null;
}): Presentation {
  const { name, localSeats, animate } = opts;
  const [log, setLog] = useState<LogLine[]>(() => opts.initialLog ?? []);
  const [lastEvents, setLastEvents] = useState<GameEvent[]>([]);
  const [lastRoll, setLastRoll] = useState<LastRoll | null>(() => opts.initialLastRoll ?? null);
  const [rolling, setRolling] = useState(false);
  const nextId = useRef(Math.max(0, ...(opts.initialLog ?? []).map((l) => l.id + 1)));
  const rollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (rollTimer.current && clearTimeout(rollTimer.current)), []);

  const ingest = useCallback(
    (events: GameEvent[]) => {
      setLastEvents(events);
      const lines: LogLine[] = [];
      for (const e of events) {
        const d = describe(e, name);
        if (d) lines.push({ id: nextId.current++, ...d });
      }
      const appendLog = () => lines.length && setLog((prev) => [...lines.reverse(), ...prev].slice(0, MAX_LOG));

      const roll = events.find((e) => e.type === "rolled");
      if (roll && roll.type === "rolled") {
        setLastRoll((prev) => ({ seat: roll.seat, value: roll.value, n: (prev?.n ?? 0) + 1 }));
      }
      if (roll && animate && !reducedMotion()) {
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
      sfx.playCues(cuesFor(events, localSeats));
    },
    [name, localSeats, animate],
  );

  const reset = useCallback(() => {
    setLog([]);
    setLastEvents([]);
    setLastRoll(null);
    setRolling(false);
  }, []);

  return { log, lastEvents, lastRoll, rolling, ingest, reset };
}
