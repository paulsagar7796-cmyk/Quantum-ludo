import { useEffect, useState } from "react";

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 25], [72, 25], [28, 50], [72, 50], [28, 75], [72, 75]],
};

/** While `rolling`, the die tumbles through random faces; then it lands on `value`. */
export function Die({ value, color, rollKey, rolling }: { value: number | null; color: string; rollKey: number; rolling: boolean }) {
  const [face, setFace] = useState<number | null>(value);

  useEffect(() => {
    if (!rolling) {
      setFace(value);
      return;
    }
    let last = 0;
    const id = setInterval(() => {
      let next = 1 + Math.floor(Math.random() * 6);
      if (next === last) next = (next % 6) + 1;
      last = next;
      setFace(next);
    }, 70);
    return () => clearInterval(id);
  }, [rolling, value, rollKey]);

  const shown = rolling ? face : value;
  return (
    <svg
      key={rollKey}
      viewBox="0 0 100 100"
      className={`h-12 w-12 shrink-0 ${rolling ? "die-tumble" : "die-pop"}`}
      role="img"
      aria-label={rolling ? "Rolling the die" : value ? `Die shows ${value}` : "Die not rolled yet"}
    >
      <rect x={4} y={4} width={92} height={92} rx={20} fill="#f8fafc" stroke={color} strokeWidth={8} />
      {shown && PIPS[shown]!.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={9} fill="#0b1020" />)}
      {!shown && (
        <text x={50} y={64} textAnchor="middle" fontSize={44} fontWeight={800} fill="#94a3b8">
          ?
        </text>
      )}
    </svg>
  );
}
