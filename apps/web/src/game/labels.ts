import type { Color, Mechanic } from "@qludo/engine";

export const COLOR_NAME: Record<Color, string> = {
  red: "Red",
  green: "Green",
  yellow: "Yellow",
  blue: "Blue",
};

/** Token fill, a lighter tint for squares, and a dark stroke. */
export const COLOR_HEX: Record<Color, { base: string; tint: string; deep: string }> = {
  red: { base: "#ef4444", tint: "#7f1d1d", deep: "#450a0a" },
  green: { base: "#22c55e", tint: "#14532d", deep: "#052e16" },
  yellow: { base: "#eab308", tint: "#713f12", deep: "#422006" },
  blue: { base: "#3b82f6", tint: "#1e3a8a", deep: "#172554" },
};

/** Each colour also has a shape, so tokens are distinguishable without colour vision. */
export const COLOR_SHAPE: Record<Color, "circle" | "triangle" | "square" | "diamond"> = {
  red: "circle",
  green: "triangle",
  yellow: "square",
  blue: "diamond",
};

export const MECHANIC: Record<Mechanic, { name: string; verb: string; hint: string; color: string }> = {
  superpose: {
    name: "Split",
    verb: "Split",
    hint: "Put this token on two squares at once: the roll and 7 minus the roll.",
    color: "#a78bfa",
  },
  entangle: {
    name: "Link",
    verb: "Link",
    hint: "Free action. Linked tokens move together: the partner gets half of every roll.",
    color: "#22d3ee",
  },
  ghost: {
    name: "Ghost",
    verb: "Ghost",
    hint: "Move and become immune until your next turn. Can't capture or enter the home column.",
    color: "#e2e8f0",
  },
  observe: {
    name: "Force",
    verb: "Force",
    hint: "Free action. Collapse an opponent's split token now.",
    color: "#f472b6",
  },
};
