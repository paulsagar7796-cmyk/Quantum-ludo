import type { AnswerPayload, OfferPayload } from "./protocol";
import {
  bytesToIpv6,
  bytesToMdns,
  expand,
  ipv4ToBytes,
  ipv6ToBytes,
  minify,
  uuidToBytes,
  type CandidateAddress,
  type DtlsSetup,
} from "./sdp";

/**
 * Pairing codes carry a WebRTC offer or answer between devices, as a QR code or pasted text.
 * QL1: the JSON payload, compressed and base64url-encoded (fallback, and older codes).
 * QL2: compact binary form; what the app normally produces.
 */

const PREFIX = "QL1.";

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

export async function encodeSignal(payload: unknown): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(payload));
  return PREFIX + toBase64Url(await pipe(json, new CompressionStream("deflate-raw")));
}

export async function decodeSignal<T>(code: string): Promise<T> {
  const trimmed = code.trim();
  if (!trimmed.startsWith(PREFIX)) throw new Error("That is not a Quantum Ludo code.");
  try {
    const bytes = await pipe(fromBase64Url(trimmed.slice(PREFIX.length)), new DecompressionStream("deflate-raw"));
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    throw new Error("That code is damaged or incomplete.");
  }
}

// ---- Compact pairing codes (QL2) ------------------------------------------------------------
// Binary-packed essentials (see sdp.ts), base32-encoded in capitals so the QR code can use its
// denser alphanumeric mode. About a quarter the length of a QL1 code.

const PREFIX2 = "QL2.";
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const SETUPS: DtlsSetup[] = ["actpass", "active", "passive"];
const ADDRESS_KINDS: CandidateAddress["kind"][] = ["ipv4", "ipv6", "mdns", "host"];

function toBase32(bytes: number[]): string {
  let out = "";
  let bits = 0;
  let value = 0;
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function fromBase32(text: string): number[] {
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of text) {
    const v = B32.indexOf(ch);
    if (v < 0) throw new Error("bad character");
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return out;
}

function packString(out: number[], s: string): void {
  const bytes = [...new TextEncoder().encode(s)].slice(0, 255);
  out.push(bytes.length, ...bytes);
}

/** Encodes an offer or answer as compactly as possible, falling back to QL1 for unusual SDPs. */
export async function encodePairing(payload: OfferPayload | AnswerPayload): Promise<string> {
  const mini = minify(payload.sdp);
  if (!mini || mini.candidates.length > 15) return encodeSignal(payload);
  const out: number[] = [];
  out.push((1 << 4) | (SETUPS.indexOf(mini.setup) << 1) | (payload.k === "answer" ? 1 : 0), payload.seat);
  packString(out, payload.k === "offer" ? payload.hostName : payload.name);
  packString(out, mini.ufrag);
  packString(out, mini.pwd);
  out.push(...mini.fingerprint, mini.candidates.length);
  for (const c of mini.candidates) {
    out.push(ADDRESS_KINDS.indexOf(c.address.kind));
    if (c.address.kind === "ipv4") out.push(...ipv4ToBytes(c.address.value));
    else if (c.address.kind === "ipv6") out.push(...ipv6ToBytes(c.address.value));
    else if (c.address.kind === "mdns") out.push(...uuidToBytes(c.address.value));
    else packString(out, c.address.value);
    out.push(c.port >> 8, c.port & 0xff);
  }
  return PREFIX2 + toBase32(out);
}

/** Decodes a QL2 or QL1 pairing code back into an offer or answer with a full SDP. */
export async function decodePairing(code: string): Promise<OfferPayload | AnswerPayload> {
  const trimmed = code.trim().replace(/\s+/g, "");
  if (!trimmed.toUpperCase().startsWith(PREFIX2)) return decodeSignal<OfferPayload | AnswerPayload>(trimmed);
  try {
    const b = fromBase32(trimmed.slice(PREFIX2.length).toUpperCase());
    let i = 0;
    const take = (n: number) => {
      if (i + n > b.length) throw new Error("short");
      const s = b.slice(i, i + n);
      i += n;
      return s;
    };
    const str = () => new TextDecoder().decode(Uint8Array.from(take(take(1)[0]!)));
    const [head, seat] = take(2) as [number, number];
    if (head >> 4 !== 1) throw new Error("version");
    const isAnswer = (head & 1) === 1;
    const setup = SETUPS[(head >> 1) & 3]!;
    const name = str();
    const ufrag = str();
    const pwd = str();
    const fingerprint = Uint8Array.from(take(32));
    const candidates = Array.from({ length: take(1)[0]! }, () => {
      const kind = ADDRESS_KINDS[take(1)[0]!];
      const value =
        kind === "ipv4"
          ? take(4).join(".")
          : kind === "ipv6"
            ? bytesToIpv6(take(16))
            : kind === "mdns"
              ? bytesToMdns(take(16))
              : str();
      const [hi, lo] = take(2) as [number, number];
      return { address: { kind, value } as CandidateAddress, port: (hi << 8) | lo };
    });
    const sdp = expand({ ufrag, pwd, fingerprint, setup, candidates });
    return isAnswer ? { k: "answer", sdp, seat, name } : { k: "offer", sdp, seat, hostName: name };
  } catch {
    throw new Error("That code is damaged or incomplete.");
  }
}
