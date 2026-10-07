import { MECHANIC } from "../game/labels";
import { Modal } from "./Modal";

const KEYS: [string, string][] = [
  ["Space", "Roll"],
  ["1–4", "Pick a token"],
  ["Enter", "Move the picked token"],
  ["S / G", "Split / Ghost the picked token"],
  ["L / F", "Link / Force"],
  ["A / B / H", "Land a Split on A or B, or Hold it"],
  ["P", "Pass"],
  ["Esc", "Cancel"],
];

export function Help({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="How to play" onClose={onClose} wide>
      <div className="space-y-4 text-sm leading-relaxed text-muted">
        <section>
          <h3 className="mb-1 font-semibold text-text">The race</h3>
          <p>
            Roll a 6 to bring a token out. Move clockwise and up your home column; you need the exact roll to get home. Land on a lone
            opponent on a normal square to capture it. Stars and start squares are safe. A 6 gives another roll (a third 6 in a row is
            lost). First to get all four tokens home wins.
          </p>
        </section>
        <section>
          <h3 className="mb-1 font-semibold text-text">Quantum charges (Q)</h3>
          <p>
            You start with 1 Q and hold up to 4. Land exactly on a glowing Node (the safe squares) to gain 1 Q; a Node then rests until the
            next round. You also get 1 Q when one of your tokens is captured. Every quantum action costs 1 Q.
          </p>
        </section>
        <section className="grid gap-2 sm:grid-cols-2">
          {Object.values(MECHANIC).map((m) => (
            <div key={m.name} className="rounded-xl border border-line bg-panel-2 p-3">
              <h4 className="font-semibold" style={{ color: m.color }}>
                {m.name}
              </h4>
              <p>{m.hint}</p>
            </div>
          ))}
        </section>
        <section>
          <h3 className="mb-1 font-semibold text-text">Split in detail</h3>
          <p>
            A split token sits on two markers, A and B. At the start of your next turn you pick where it lands, or hold it open once more.
            If an opponent lands on a marker, a coin decides whether your token was really there.
          </p>
        </section>
        <section>
          <h3 className="mb-1 font-semibold text-text">Scoring</h3>
          <p>
            Token home +10, capture +3 (+4 on a split token), being captured −1, +1 per 5 squares of progress at the end, placement bonus
            +15 / +8 / +4, and up to 2 points for unspent Q.
          </p>
        </section>
        <section className="hidden md:block">
          <h3 className="mb-1 font-semibold text-text">Keyboard</h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            {KEYS.map(([k, v]) => (
              <div key={k} className="contents">
                <dt>
                  <kbd className="rounded border border-line px-1.5 text-text">{k}</kbd>
                </dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </Modal>
  );
}
