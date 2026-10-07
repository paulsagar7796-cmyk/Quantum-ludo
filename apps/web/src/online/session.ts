import type { Seat } from "./api";

/** The online room this device is in, kept so a refresh or a closed tab can rejoin. */
const KEY = "qludo.online.v1";

export function loadSession(): Seat | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as Seat | null;
    return s && typeof s.code === "string" && typeof s.token === "string" ? s : null;
  } catch {
    return null;
  }
}

export function saveSession(s: Seat): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Not critical: the player just can't rejoin after a refresh.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do.
  }
}
