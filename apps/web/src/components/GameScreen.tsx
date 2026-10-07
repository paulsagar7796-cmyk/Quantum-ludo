import { mustCollapse, type Action, type GameEvent, type MarkerIndex } from "@qludo/engine";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { canLink, forceOptions, has, linkableTokens, tokenChoices, type TokenChoice } from "../game/interaction";
import { COLOR_HEX, MECHANIC } from "../game/labels";
import { pointFor } from "../game/layout";
import type { MatchConfig } from "../game/match";
import type { SavedGame } from "../game/save";
import { sfx } from "../game/sound";
import { useGame } from "../game/useGame";
import { ActionBar, type ActionButton } from "./ActionBar";
import { Board, type MarkerTarget, type Preview } from "./Board";
import { Die } from "./Die";
import { EventLog } from "./EventLog";
import { Help } from "./Help";
import { Modal } from "./Modal";
import { ColorChip, PlayerPanel } from "./PlayerPanel";
import { Results } from "./Results";

type Mode = "idle" | "link" | "force";
type Armed = "split" | "ghost" | null;

/** The one event from the last action worth a big on-board callout. */
function headline(events: GameEvent[], name: (seat: number) => string): { text: string; color: string } | null {
  for (const e of events) {
    if (e.type === "playerFinished") return { text: `${name(e.seat)} is home!`, color: "#4ade80" };
    if (e.type === "captured") return { text: e.wasSplit ? "Split token captured!" : "Captured!", color: "#fb7185" };
    if (e.type === "hit" && !e.success) return { text: "Coin: not there!", color: "#c4b5fd" };
    if (e.type === "forfeit") return { text: "Third 6: turn lost", color: "#fb7185" };
  }
  return null;
}

function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" />
      {on ? <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /> : <path d="m16 9 6 6M22 9l-6 6" />}
    </svg>
  );
}

export function GameScreen({
  match,
  resume,
  onNewGame,
  onRematch,
}: {
  match: MatchConfig;
  resume: SavedGame | null;
  onNewGame: () => void;
  onRematch: () => void;
}) {
  const g = useGame(match, resume);
  const { state, legal, dispatch, isHumanTurn, name } = g;
  // Hot-seat with several humans: hand the device over at the start of each human turn.
  const humanCount = match.seats.slice(0, match.playerCount).filter((s) => s.kind === "human").length;
  const [readyTurn, setReadyTurn] = useState<number | null>(null);
  const handoff =
    humanCount >= 2 && isHumanTurn && state.phase === "upkeep" && !state.bonus && readyTurn !== state.turn;
  // While the die tumbles (or the device is being passed), nothing can be chosen yet.
  const canAct = isHumanTurn && !g.rolling && !handoff;
  const [soundOn, setSoundOn] = useState(sfx.enabled);
  const me = state.players[state.current]!;

  const [selected, setSelected] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [armed, setArmed] = useState<Armed>(null);
  const [linkFirst, setLinkFirst] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showResults, setShowResults] = useState(true);
  const [confirmQuit, setConfirmQuit] = useState(false);

  // Any change to the game clears half-finished choices (React's "reset state when an input changes" pattern).
  const [choicesFor, setChoicesFor] = useState(state);
  if (choicesFor !== state) {
    setChoicesFor(state);
    setSelected(null);
    setMode("idle");
    setArmed(null);
    setLinkFirst(null);
  }

  const act = useCallback((a: Action) => dispatch(a), [dispatch]);

  const choices = useMemo(
    () => (canAct ? tokenChoices(state, legal) : new Map<number, TokenChoice>()),
    [canAct, state, legal],
  );
  const movable = [...choices.keys()];
  // Auto-pick when there is only one real choice, e.g. every movable token is still in the yard.
  const samePlace = new Set(movable.map((t) => (me.tokens[t]!.split ? `s${t}` : me.tokens[t]!.pos))).size === 1;
  const sel = selected ?? (movable.length > 0 && samePlace ? movable[0]! : null);
  const choice = sel !== null ? choices.get(sel) : undefined;
  const linkable = useMemo(() => linkableTokens(legal), [legal]);
  const forces = useMemo(() => forceOptions(legal), [legal]);
  const collapsing = canAct && mustCollapse(state);
  const tactical = state.config.observationMode === "choice";

  // ---- What the board shows -------------------------------------------------
  const previews: Preview[] = [];
  if (canAct && choice && mode === "idle") {
    const color = me.color;
    if (armed === "split" && choice.split) {
      choice.split.forEach((m, i) =>
        previews.push({
          point: pointFor(color, m, choice.token),
          kind: "split",
          label: i === 0 ? "A" : "B",
          onClick: () => act({ type: "superpose", token: choice.token }),
        }),
      );
    } else if (armed === "ghost" && choice.ghost !== null) {
      previews.push({
        point: pointFor(color, choice.ghost, choice.token),
        kind: "ghost",
        label: "G",
        onClick: () => act({ type: "ghost", token: choice.token }),
      });
    } else if (choice.move !== null) {
      previews.push({
        point: pointFor(color, choice.move, choice.token),
        kind: "move",
        onClick: () => act({ type: "move", token: choice.token }),
      });
    }
  }

  const markerTargets: MarkerTarget[] = [];
  if (collapsing) {
    const token = me.tokens.findIndex((t) => t.split);
    for (const marker of [0, 1] as MarkerIndex[])
      markerTargets.push({ seat: me.seat, token, marker, onClick: () => act({ type: "collapse", marker }) });
  } else if (canAct && mode === "force") {
    for (const f of forces) {
      const markers: MarkerIndex[] = f.marker === undefined ? [0, 1] : [f.marker];
      for (const marker of markers)
        markerTargets.push({
          ...f.target,
          marker,
          onClick: () =>
            act({ type: "observe", target: f.target, ...(f.marker !== undefined ? { marker: f.marker } : {}) }),
        });
    }
  }

  let selectableTokens: Set<number> | null = null;
  if (canAct && state.phase === "act") {
    if (mode === "link")
      selectableTokens = new Set(
        [...linkable].filter((t) => linkFirst === null || t === linkFirst || canLink(legal, linkFirst, t)),
      );
    else if (mode === "idle") selectableTokens = new Set(movable);
  }

  const onTokenClick = (_seat: number, token: number) => {
    if (mode === "link") {
      if (linkFirst === null || linkFirst === token) return setLinkFirst(linkFirst === token ? null : token);
      return act({ type: "entangle", tokens: [linkFirst, token] });
    }
    setSelected(token);
    setArmed(null);
  };

  // ---- Prompt and buttons ----------------------------------------------------
  const cancel = () => {
    setMode("idle");
    setArmed(null);
    setLinkFirst(null);
  };
  let prompt: ReactNode;
  const buttons: ActionButton[] = [];
  const roll = state.roll;

  if (state.phase === "over") {
    prompt = <span className="font-semibold">Game over.</span>;
    buttons.push({ id: "results", label: "Show results", tone: "primary", onClick: () => setShowResults(true) });
  } else if (g.rolling && g.lastRoll) {
    prompt = (
      <span>
        <span className="font-semibold" style={{ color: COLOR_HEX[state.players[g.lastRoll.seat]!.color].base }}>
          {name(g.lastRoll.seat)}
        </span>{" "}
        {name(g.lastRoll.seat) === "You" ? "are" : "is"} rolling…
      </span>
    );
  } else if (handoff) {
    prompt = <span>Waiting for {name(me.seat) === "You" ? "you" : name(me.seat)} to take the device…</span>;
  } else if (!isHumanTurn) {
    prompt = (
      <span>
        <span className="font-semibold" style={{ color: COLOR_HEX[me.color].base }}>
          {name(me.seat)}
        </span>{" "}
        is thinking…
      </span>
    );
  } else if (collapsing) {
    prompt = (
      <span>
        Your Split must land. Tap marker <b>A</b> or <b>B</b>
        {has(legal, "hold") ? ", or hold it open one more round" : ""}.
      </span>
    );
    buttons.push({
      id: "a",
      label: "Land on A",
      tone: "split",
      shortcut: "A",
      onClick: () => act({ type: "collapse", marker: 0 }),
    });
    buttons.push({
      id: "b",
      label: "Land on B",
      tone: "split",
      shortcut: "B",
      onClick: () => act({ type: "collapse", marker: 1 }),
    });
    if (has(legal, "hold"))
      buttons.push({
        id: "hold",
        label: "Hold",
        sub: "1 more round",
        tone: "secondary",
        shortcut: "H",
        onClick: () => act({ type: "hold" }),
      });
  } else if (state.phase === "upkeep") {
    prompt = state.bonus ? (
      <span className="font-semibold">You rolled a 6: roll again!</span>
    ) : (
      <span>Your turn. Roll the die.</span>
    );
    buttons.push({
      id: "roll",
      label: "Roll",
      tone: "primary",
      shortcut: "Space",
      onClick: () => act({ type: "roll" }),
    });
    if (has(legal, "decouple"))
      buttons.push({
        id: "decouple",
        label: "Break Link",
        sub: "free",
        tone: "secondary",
        onClick: () => act({ type: "decouple" }),
      });
  } else if (mode === "link") {
    prompt = (
      <span>
        <b className="text-link">Link</b> (1 Q): tap {linkFirst === null ? "two of your tokens" : "a second token"} to
        link them.
      </span>
    );
    buttons.push({ id: "cancel", label: "Cancel", tone: "secondary", shortcut: "Esc", onClick: cancel });
  } else if (mode === "force") {
    prompt = tactical ? (
      <span>
        <b className="text-force">Force</b> (1 Q): tap the marker where the opponent's token must land.
      </span>
    ) : (
      <span>
        <b className="text-force">Force</b> (1 Q): tap an opponent's split token. A coin decides where it lands.
      </span>
    );
    buttons.push({ id: "cancel", label: "Cancel", tone: "secondary", shortcut: "Esc", onClick: cancel });
  } else if (armed && choice) {
    const m = armed === "split" ? MECHANIC.superpose : MECHANIC.ghost;
    prompt = (
      <span>
        <b style={{ color: m.color }}>{m.name}</b> (1 Q): {m.hint}
      </span>
    );
    buttons.push({
      id: "confirm",
      label: `Confirm ${m.name}`,
      tone: armed,
      shortcut: "Enter",
      onClick: () =>
        act(armed === "split" ? { type: "superpose", token: choice.token } : { type: "ghost", token: choice.token }),
    });
    buttons.push({ id: "cancel", label: "Cancel", tone: "secondary", shortcut: "Esc", onClick: cancel });
  } else {
    const what =
      movable.length === 0
        ? "No normal move."
        : sel === null
          ? "Tap a token to move it."
          : "Tap the highlighted square to move.";
    prompt = (
      <span>
        You rolled <b>{roll}</b>. {what}
        {me.q > 0 && <span className="text-muted"> You have {me.q} Q.</span>}
      </span>
    );
    if (choice?.move !== null && choice)
      buttons.push({
        id: "move",
        label: "Move",
        tone: "primary",
        shortcut: "Enter",
        onClick: () => act({ type: "move", token: choice.token }),
      });
    if (choice?.split)
      buttons.push({
        id: "split",
        label: "Split",
        sub: "1 Q",
        tone: "split",
        shortcut: "S",
        title: MECHANIC.superpose.hint,
        onClick: () => setArmed("split"),
      });
    if (choice && choice.ghost !== null)
      buttons.push({
        id: "ghost",
        label: "Ghost",
        sub: "1 Q",
        tone: "ghost",
        shortcut: "G",
        title: MECHANIC.ghost.hint,
        onClick: () => setArmed("ghost"),
      });
    if (linkable.size > 0)
      buttons.push({
        id: "link",
        label: "Link",
        sub: "free · 1 Q",
        tone: "link",
        shortcut: "L",
        title: MECHANIC.entangle.hint,
        onClick: () => setMode("link"),
      });
    if (forces.length > 0)
      buttons.push({
        id: "force",
        label: "Force",
        sub: "free · 1 Q",
        tone: "force",
        shortcut: "F",
        title: MECHANIC.observe.hint,
        onClick: () => setMode("force"),
      });
    if (has(legal, "pass"))
      buttons.push({
        id: "pass",
        label: "Pass",
        sub: "no move",
        tone: movable.length ? "secondary" : "primary",
        shortcut: "P",
        onClick: () => act({ type: "pass" }),
      });
  }

  // ---- Keyboard ----------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!canAct || showHelp || e.target instanceof HTMLInputElement) return;
      const key = e.key.toLowerCase();
      const press = (id: string) => {
        const b = buttons.find((x) => x.id === id);
        if (!b) return false;
        e.preventDefault();
        b.onClick();
        return true;
      };
      if (key === " " && press("roll")) return;
      if (key === "enter" && (press("confirm") || press("move") || press("roll"))) return;
      if (key === "escape" && press("cancel")) return;
      if (/^[1-4]$/.test(key) && mode === "idle" && choices.has(Number(key) - 1)) {
        setSelected(Number(key) - 1);
        setArmed(null);
        return;
      }
      const map: Record<string, string> = {
        s: "split",
        g: "ghost",
        l: "link",
        f: "force",
        p: "pass",
        a: "a",
        b: "b",
        h: "hold",
      };
      if (map[key]) press(map[key]!);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const callout = headline(g.lastEvents, name);
  const rollerColor = g.lastRoll ? COLOR_HEX[state.players[g.lastRoll.seat]!.color].base : "#94a3b8";
  const isBot = (seat: number) => match.seats[seat]!.kind === "bot";

  const toolbar = (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => {
          sfx.enabled = !soundOn;
          setSoundOn(!soundOn);
        }}
        aria-pressed={soundOn}
        aria-label={soundOn ? "Sound on" : "Sound off"}
        title={soundOn ? "Sound on" : "Sound off"}
        className="rounded-lg px-2 py-1.5 text-muted hover:bg-panel-2 hover:text-text"
      >
        <SpeakerIcon on={soundOn} />
      </button>
      <button
        type="button"
        onClick={() => setShowHelp(true)}
        className="rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-panel-2 hover:text-text"
      >
        Rules
      </button>
      <button
        type="button"
        onClick={() => setConfirmQuit(true)}
        className="rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-panel-2 hover:text-text"
      >
        Quit
      </button>
    </div>
  );
  const modeLabel = tactical ? "Tactical" : "Chaos";

  return (
    <div className="mx-auto flex h-dvh max-w-[1400px] flex-col gap-2 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:grid lg:grid-cols-[260px_minmax(0,1fr)_300px] lg:gap-4 lg:p-4">
      {/* Desktop left gutter */}
      <aside className="hidden min-h-0 flex-col gap-3 lg:flex">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-black tracking-tight">Quantum Ludo</h1>
        </div>
        <p className="text-xs text-muted">
          Round {state.round} · {modeLabel} Force
        </p>
        <PlayerPanel state={state} name={name} isBot={isBot} />
        <div className="mt-auto">{toolbar}</div>
      </aside>

      <main className="flex min-h-0 flex-1 flex-col gap-2 lg:mx-auto lg:w-full lg:max-w-[min(100%,calc(100dvh-2rem))]">
        {/* Mobile header */}
        <header className="flex flex-col gap-2 lg:hidden">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-black tracking-tight">
              Quantum Ludo{" "}
              <span className="text-xs font-normal text-muted">
                · Round {state.round} · {modeLabel}
              </span>
            </h1>
            {toolbar}
          </div>
          <PlayerPanel state={state} name={name} isBot={isBot} compact />
        </header>

        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          <Board
            state={state}
            selectable={selectableTokens ? { seat: me.seat, tokens: selectableTokens } : null}
            selected={mode === "link" ? linkFirst : sel}
            previews={previews}
            markerTargets={markerTargets}
            onTokenClick={onTokenClick}
          />
          {callout && (
            <div
              key={g.log[0]?.id}
              className="die-pop pointer-events-none absolute top-[38%] rounded-xl border border-white/20 bg-ink/85 px-4 py-2 text-lg font-black shadow-xl"
              style={{ color: callout.color, animation: "pop 320ms ease-out, fade 1.8s ease-in 0.6s forwards" }}
            >
              {callout.text}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowLog(true)}
          className="truncate text-left text-xs text-muted lg:hidden"
        >
          {g.log[0]?.text ?? "Moves will appear here."} <span className="text-split">· log</span>
        </button>

        <ActionBar
          die={
            <Die
              value={g.lastRoll?.value ?? null}
              color={rollerColor}
              rollKey={g.lastRoll?.n ?? 0}
              rolling={g.rolling}
            />
          }
          prompt={prompt}
          buttons={buttons}
        />
      </main>

      {/* Desktop right gutter */}
      <aside className="hidden min-h-0 flex-col gap-2 lg:flex">
        <h2 className="text-sm font-semibold text-muted">Move log</h2>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <EventLog log={g.log} state={state} />
        </div>
      </aside>

      {handoff && (
        <Modal title="Pass the device">
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <ColorChip player={me} size={48} />
            <p className="text-xl font-bold" style={{ color: COLOR_HEX[me.color].base }}>
              {name(me.seat) === "You" ? "Your turn" : `${name(me.seat)}’s turn`}
            </p>
            <p className="text-sm text-muted">Hand the device over, then tap when ready.</p>
            <button
              type="button"
              autoFocus
              onClick={() => setReadyTurn(state.turn)}
              className="min-h-12 w-full rounded-xl bg-white text-base font-bold text-ink hover:bg-slate-200"
            >
              I&rsquo;m ready
            </button>
          </div>
        </Modal>
      )}
      {showHelp && <Help onClose={() => setShowHelp(false)} />}
      {showLog && (
        <Modal title="Move log" onClose={() => setShowLog(false)}>
          <EventLog log={g.log} state={state} />
        </Modal>
      )}
      {confirmQuit && (
        <Modal title="Back to the lobby?" onClose={() => setConfirmQuit(false)}>
          <p className="mb-4 text-sm text-muted">Your game is saved. You can resume it from the lobby.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onNewGame}
              className="min-h-11 flex-1 rounded-xl bg-white font-semibold text-ink hover:bg-slate-200"
            >
              Go to lobby
            </button>
            <button
              type="button"
              onClick={() => setConfirmQuit(false)}
              className="min-h-11 flex-1 rounded-xl border border-line bg-panel-2 font-semibold hover:bg-line"
            >
              Keep playing
            </button>
          </div>
        </Modal>
      )}
      {state.result && showResults && (
        <Results
          state={state}
          result={state.result}
          name={name}
          onRematch={onRematch}
          onNewGame={onNewGame}
          onClose={() => setShowResults(false)}
        />
      )}
    </div>
  );
}
