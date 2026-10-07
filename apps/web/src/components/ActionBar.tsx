import type { ReactNode } from "react";

export type ButtonTone = "primary" | "secondary" | "split" | "link" | "ghost" | "force";

export interface ActionButton {
  id: string;
  label: string;
  /** Small second line, e.g. a cost. */
  sub?: string;
  tone: ButtonTone;
  onClick: () => void;
  active?: boolean;
  shortcut?: string;
  title?: string;
}

const TONE: Record<ButtonTone, string> = {
  primary: "bg-white text-ink hover:bg-slate-200 border-white",
  secondary: "bg-panel-2 text-text hover:bg-line border-line",
  split: "bg-split/15 text-split hover:bg-split/25 border-split/60",
  link: "bg-link/15 text-link hover:bg-link/25 border-link/60",
  ghost: "bg-ghost/10 text-ghost hover:bg-ghost/20 border-ghost/50",
  force: "bg-force/15 text-force hover:bg-force/25 border-force/60",
};

export function ActionBar({ die, prompt, buttons }: { die: ReactNode; prompt: ReactNode; buttons: ActionButton[] }) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-3 shadow-lg shadow-black/30" aria-label="Actions">
      <div className="flex items-center gap-3">
        {die}
        <div className="min-h-12 flex-1 text-sm leading-snug" aria-live="polite">
          {prompt}
        </div>
      </div>
      {buttons.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {buttons.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={b.onClick}
              title={b.title}
              aria-pressed={b.active}
              aria-keyshortcuts={b.shortcut}
              className={`flex min-h-11 min-w-20 flex-1 flex-col items-center justify-center rounded-xl border px-3 py-1.5 text-sm font-semibold transition-colors ${TONE[b.tone]} ${
                b.active ? "ring-2 ring-white/80" : ""
              }`}
            >
              <span>
                {b.label}
                {b.shortcut && <kbd className="ml-1.5 hidden rounded border border-current/30 px-1 text-[10px] font-normal opacity-70 md:inline">{b.shortcut}</kbd>}
              </span>
              {b.sub && <span className="text-[11px] font-normal opacity-80">{b.sub}</span>}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
