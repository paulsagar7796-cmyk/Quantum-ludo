import type { Action } from "@qludo/engine";
import type { Room, RoomMatch } from "@qludo/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

let client: SupabaseClient | null = null;

/** One shared client, created on first use so offline play never loads it. */
export function supabase(): SupabaseClient {
  client ??= createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  return client;
}

export interface Seat {
  code: string;
  seat: number;
  token: string;
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Can't reach the game server. Check your internet connection.");
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Server error (${res.status}).`);
  return data;
}

export const api = {
  create: (name: string, match: RoomMatch) => call<Seat>({ op: "create", name, match }),
  join: (code: string, name: string, token?: string) => call<Seat>({ op: "join", code, name, token }),
  start: (s: Seat) => call<{ ok: true }>({ op: "start", code: s.code, token: s.token }),
  act: (s: Seat, action: Action) => call<{ ok: true }>({ op: "act", code: s.code, token: s.token, action }),
  bot: (s: Seat, seat: number) => call<{ ok: true }>({ op: "bot", code: s.code, token: s.token, seat }),
};

export async function fetchRoom(code: string): Promise<Room | null> {
  const { data, error } = await supabase()
    .from("rooms")
    .select("code,status,match,state,version,steps")
    .eq("code", code)
    .maybeSingle();
  if (error) throw new Error("Couldn't load the room.");
  return data as Room | null;
}
