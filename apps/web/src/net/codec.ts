/**
 * Pairing codes: a small JSON payload (WebRTC offer or answer) compressed and base64url-encoded,
 * short enough for a QR code or for pasting into a message.
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
