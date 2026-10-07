import { PERSONALITIES, PERSONALITY_IDS, type PersonalityId } from "@qludo/bots";
import { SEAT_COLORS, type ObservationMode, type PlayerCount } from "@qludo/engine";
import { useState } from "react";
import { COLOR_HEX, COLOR_NAME, MECHANIC } from "../game/labels";
import { seatName, type BotSpeed, type MatchConfig, type SeatConfig } from "../game/match";
import type { SavedGame } from "../game/save";
import { sfx } from "../game/sound";
import { Help } from "./Help";

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl border border-line bg-panel-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-10 flex-1 rounded-lg px-3 text-sm font-semibold transition-colors ${
            value === o.value ? "bg-white text-ink" : "text-muted hover:text-text"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const MODE_TEXT: Record<ObservationMode, string> = {
  coin: "Force flips a coin to decide where an opponent's Split lands. Gamble, swings and upsets.",
  choice: "You choose where an opponent's Split lands, then strike it with the same roll. Pure calculation.",
};

function ago(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

function ResumeCard({ saved, onResume, onDiscard }: { saved: SavedGame; onResume: () => void; onDiscard: () => void }) {
  const players = saved.state.players.map((p) => seatName(saved.match, p.seat));
  return (
    <section className="rounded-2xl border border-split/50 bg-split/10 p-3" aria-label="Game in progress">
      <h2 className="text-sm font-semibold text-split">Game in progress</h2>
      <p className="mt-1 text-sm">
        Round {saved.state.round} · {players.join(", ")}
      </p>
      <p className="text-xs text-muted">Saved {ago(Date.now() - saved.savedAt)}</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onResume} className="min-h-11 flex-1 rounded-xl bg-white font-semibold text-ink hover:bg-slate-200">
          Resume game
        </button>
        <button type="button" onClick={onDiscard} className="min-h-11 rounded-xl border border-line bg-panel-2 px-4 text-sm font-semibold hover:bg-line">
          Discard
        </button>
      </div>
    </section>
  );
}

export function Lobby({
  initial,
  saved,
  onStart,
  onResume,
  onDiscard,
}: {
  initial: MatchConfig;
  saved: SavedGame | null;
  onStart: (m: MatchConfig) => void;
  onResume: (s: SavedGame) => void;
  onDiscard: () => void;
}) {
  const [m, setM] = useState<MatchConfig>(initial);
  const [showHelp, setShowHelp] = useState(false);
  const [soundOn, setSoundOn] = useState(sfx.enabled);
  const colors = SEAT_COLORS[m.playerCount];

  const setSeat = (i: number, patch: Partial<SeatConfig>) =>
    setM((prev) => ({ ...prev, seats: prev.seats.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col gap-5 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="text-center">
        <img src="/icon.svg" alt="" className="mx-auto mb-3 h-16 w-16" />
        <h1 className="text-3xl font-black tracking-tight">Quantum Ludo</h1>
        <p className="mt-1 text-sm text-muted">Ludo, evolved. Split, Link, Ghost and Force your way home.</p>
      </header>

      {saved && <ResumeCard saved={saved} onResume={() => onResume(saved)} onDiscard={onDiscard} />}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">Players</h2>
        <Segmented<PlayerCount>
          label="Number of players"
          value={m.playerCount}
          options={[2, 3, 4].map((n) => ({ value: n as PlayerCount, label: `${n} players` }))}
          onChange={(playerCount) => setM({ ...m, playerCount })}
        />
        <ul className="flex flex-col gap-2">
          {colors.map((color, i) => {
            const seat = m.seats[i]!;
            return (
              <li key={color} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel p-2">
                <span className="h-6 w-6 shrink-0 rounded-full border-2" style={{ background: COLOR_HEX[color].base, borderColor: COLOR_HEX[color].deep }} aria-hidden />
                <input
                  value={seat.name}
                  onChange={(e) => setSeat(i, { name: e.target.value })}
                  placeholder={seat.kind === "bot" ? PERSONALITIES[seat.bot].name : COLOR_NAME[color]}
                  aria-label={`${COLOR_NAME[color]} player name`}
                  maxLength={16}
                  className="min-h-10 min-w-0 flex-1 rounded-lg border border-line bg-panel-2 px-2 text-sm"
                />
                <div className="flex rounded-lg border border-line bg-panel-2 p-0.5 text-xs font-semibold">
                  {(["human", "bot"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={seat.kind === k}
                      onClick={() => setSeat(i, { kind: k })}
                      className={`min-h-9 rounded-md px-2.5 ${seat.kind === k ? "bg-white text-ink" : "text-muted"}`}
                    >
                      {k === "human" ? "Human" : "Bot"}
                    </button>
                  ))}
                </div>
                {seat.kind === "bot" && (
                  <select
                    value={seat.bot}
                    onChange={(e) => setSeat(i, { bot: e.target.value as PersonalityId })}
                    aria-label={`${COLOR_NAME[color]} bot personality`}
                    className="min-h-10 w-full rounded-lg border border-line bg-panel-2 px-2 text-sm sm:w-auto"
                  >
                    {PERSONALITY_IDS.map((id) => (
                      <option key={id} value={id}>
                        {PERSONALITIES[id].name}: {PERSONALITIES[id].description.split(".")[0]}
                      </option>
                    ))}
                  </select>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">
          <span style={{ color: MECHANIC.observe.color }}>Force</span> mode
        </h2>
        <Segmented<ObservationMode>
          label="Force mode"
          value={m.observationMode}
          options={[
            { value: "coin", label: "Chaos (coin)" },
            { value: "choice", label: "Tactical (choice)" },
          ]}
          onChange={(observationMode) => setM({ ...m, observationMode })}
        />
        <p className="text-xs text-muted">{MODE_TEXT[m.observationMode]}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">Bot speed</h2>
        <Segmented<BotSpeed>
          label="Bot speed"
          value={m.botSpeed}
          options={[
            { value: "slow", label: "Slow" },
            { value: "normal", label: "Normal" },
            { value: "fast", label: "Fast" },
          ]}
          onChange={(botSpeed) => setM({ ...m, botSpeed })}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">Sound effects</h2>
        <Segmented<"on" | "off">
          label="Sound effects"
          value={soundOn ? "on" : "off"}
          options={[
            { value: "on", label: "On" },
            { value: "off", label: "Off" },
          ]}
          onChange={(v) => {
            sfx.enabled = v === "on";
            setSoundOn(v === "on");
            if (v === "on") sfx.play("dice");
          }}
        />
      </section>

      <div className="mt-auto flex flex-col gap-2">
        <button type="button" onClick={() => onStart(m)} className="min-h-12 rounded-xl bg-white text-base font-bold text-ink hover:bg-slate-200">
          {saved ? "Start a new game" : "Start game"}
        </button>
        <button type="button" onClick={() => setShowHelp(true)} className="min-h-11 rounded-xl border border-line bg-panel text-sm font-semibold hover:bg-panel-2">
          How to play
        </button>
      </div>
      {showHelp && <Help onClose={() => setShowHelp(false)} />}
    </div>
  );
}
