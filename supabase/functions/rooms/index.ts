// Quantum Ludo online rooms (Supabase Edge Function, Deno).
//
// The server is the authority: it keeps the dice seed secret, checks every action and plays
// the bots. Game rules come from the shared engine, bundled into ./qludo.js by `pnpm build:edge`.
// Players prove who they are with a per-room token this function issues on create/join.

import { createClient } from "npm:@supabase/supabase-js@2";
import { RoomError, act, makeRoomCode, newRoom, seatToBot, startGame, validateMatch } from "./qludo.js";

// The bundle is plain JavaScript; these mirror the shapes from packages/server/src/room.ts.
interface RoomSeat {
  kind: "human" | "bot";
  bot: string;
  name: string;
}
interface RoomMatch {
  playerCount: number;
  observationMode: string;
  seats: RoomSeat[];
}
interface Room {
  code: string;
  status: "lobby" | "playing" | "over";
  match: RoomMatch;
  state: unknown;
  version: number;
  steps: unknown[];
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function random(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0]! / 4294967296;
}

function newToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function cleanName(name: unknown): string {
  const n = String(name ?? "")
    .trim()
    .slice(0, 16);
  return n || "Player";
}

function cleanCode(code: unknown): string {
  return String(code ?? "")
    .trim()
    .toUpperCase();
}

type RoomRow = Room;

async function loadRoom(code: string): Promise<RoomRow> {
  const { data, error } = await db
    .from("rooms")
    .select("code,status,match,state,version,steps")
    .eq("code", code)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new RoomError("No room with that code.", 404);
  return data as RoomRow;
}

async function loadSecret(code: string): Promise<number> {
  const { data, error } = await db.from("room_secrets").select("rng").eq("code", code).single();
  if (error) throw error;
  return Number(data.rng);
}

async function playerFor(code: string, token: unknown): Promise<{ seat: number; is_host: boolean }> {
  if (typeof token !== "string" || token.length < 20) throw new RoomError("Missing player token.", 401);
  const { data, error } = await db
    .from("room_players")
    .select("seat,is_host")
    .eq("code", code)
    .eq("token_hash", await hash(token))
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new RoomError("You are not in this room.", 403);
  return data;
}

/** Writes a new room version, only if nobody else changed it first. */
async function saveRoom(prev: RoomRow, next: RoomRow, rng?: number): Promise<void> {
  const { data, error } = await db
    .from("rooms")
    .update({
      status: next.status,
      match: next.match,
      state: next.state,
      version: next.version,
      steps: next.steps,
      updated_at: new Date().toISOString(),
    })
    .eq("code", prev.code)
    .eq("version", prev.version)
    .select("code");
  if (error) throw error;
  if (!data?.length) throw new RoomError("Someone else moved at the same time. Try again.", 409);
  if (rng !== undefined) {
    const { error: e2 } = await db.from("room_secrets").update({ rng }).eq("code", prev.code);
    if (e2) throw e2;
  }
}

async function create(body: { name?: unknown; match?: RoomMatch }) {
  // Opportunistic cleanup: rooms idle for two days are removed.
  await db
    .from("rooms")
    .delete()
    .lt("updated_at", new Date(Date.now() - 2 * 864e5).toISOString());

  const match = validateMatch(body.match as RoomMatch);
  const hostSeat = match.seats.slice(0, match.playerCount).findIndex((s) => s.kind === "human");
  const name = cleanName(body.name);
  match.seats = match.seats.map((s, i) =>
    i === hostSeat ? { ...s, name } : s.kind === "human" ? { ...s, name: "" } : s,
  );
  const token = newToken();

  for (let attempt = 0; attempt < 6; attempt++) {
    const room = newRoom(makeRoomCode(random), match);
    const { error } = await db
      .from("rooms")
      .insert({ code: room.code, status: room.status, match: room.match, state: null, version: 0, steps: [] });
    if (error?.code === "23505") continue; // code already taken
    if (error) throw error;
    const seed = Math.floor(random() * 4294967296);
    const r1 = await db.from("room_secrets").insert({ code: room.code, rng: seed });
    if (r1.error) throw r1.error;
    const r2 = await db
      .from("room_players")
      .insert({ code: room.code, seat: hostSeat, name, token_hash: await hash(token), is_host: true });
    if (r2.error) throw r2.error;
    return json({ code: room.code, seat: hostSeat, token });
  }
  throw new RoomError("Couldn't find a free room code. Try again.", 503);
}

async function join(body: { code?: unknown; name?: unknown; token?: unknown }) {
  const code = cleanCode(body.code);
  // Rejoining with a saved token gets your old seat back.
  if (typeof body.token === "string" && body.token.length >= 20) {
    try {
      const me = await playerFor(code, body.token);
      return json({ code, seat: me.seat, token: body.token });
    } catch {
      // Fall through and join as a new player.
    }
  }
  const name = cleanName(body.name);
  for (let attempt = 0; attempt < 4; attempt++) {
    const room = await loadRoom(code);
    const seat = room.match.seats.slice(0, room.match.playerCount).findIndex((s) => s.kind === "human" && !s.name);
    if (seat < 0) throw new RoomError("This room is full.", 409);
    const next: RoomRow = {
      ...room,
      match: { ...room.match, seats: room.match.seats.map((s, i) => (i === seat ? { ...s, name } : s)) },
      version: room.version + 1,
      steps: [],
    };
    try {
      await saveRoom(room, next);
    } catch (e) {
      if (e instanceof RoomError && e.status === 409) continue;
      throw e;
    }
    const token = newToken();
    const { error } = await db
      .from("room_players")
      .insert({ code, seat, name, token_hash: await hash(token), is_host: false });
    if (error) throw error;
    return json({ code, seat, token });
  }
  throw new RoomError("The room is busy. Try again.", 409);
}

async function hostOnly(body: { code?: unknown; token?: unknown }) {
  const code = cleanCode(body.code);
  const me = await playerFor(code, body.token);
  if (!me.is_host) throw new RoomError("Only the host can do that.", 403);
  return code;
}

async function start(body: { code?: unknown; token?: unknown }) {
  const code = await hostOnly(body);
  const room = await loadRoom(code);
  if (room.status === "playing") throw new RoomError("The game has already started.", 409);
  const res = startGame(room, await loadSecret(code));
  await saveRoom(room, res.room, res.rngState);
  return json({ ok: true, version: res.room.version });
}

async function play(body: { code?: unknown; token?: unknown; action?: unknown }) {
  const code = cleanCode(body.code);
  const me = await playerFor(code, body.token);
  const room = await loadRoom(code);
  const res = act(room, await loadSecret(code), me.seat, body.action);
  await saveRoom(room, res.room, res.rngState);
  return json({ ok: true, version: res.room.version });
}

async function bot(body: { code?: unknown; token?: unknown; seat?: unknown }) {
  const code = await hostOnly(body);
  const seat = Number(body.seat);
  const room = await loadRoom(code);
  const res = seatToBot(room, await loadSecret(code), seat);
  await saveRoom(room, res.room, res.rngState);
  await db.from("room_players").delete().eq("code", code).eq("seat", seat);
  return json({ ok: true, version: res.room.version });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  try {
    const body = await req.json();
    switch (body?.op) {
      case "create":
        return await create(body);
      case "join":
        return await join(body);
      case "start":
        return await start(body);
      case "act":
        return await play(body);
      case "bot":
        return await bot(body);
      default:
        throw new RoomError("Unknown request.");
    }
  } catch (e) {
    if (e instanceof RoomError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "Something went wrong on the server." }, 500);
  }
});
