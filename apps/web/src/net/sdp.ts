/**
 * Compact session descriptions for QR pairing.
 *
 * A data-channel-only WebRTC offer or answer is ~600 characters of SDP, but only a few values
 * in it are unique to the connection: the ICE username and password, the DTLS fingerprint,
 * the DTLS role, and the local network candidates. `minify` keeps those, `expand` rebuilds a
 * standard SDP around them on the other device.
 */

export type DtlsSetup = "actpass" | "active" | "passive";

export type CandidateAddress =
  | { kind: "ipv4"; value: string }
  | { kind: "ipv6"; value: string }
  /** Browsers hide local IPs behind random names like 3b1c7c2e-….local (mDNS). */
  | { kind: "mdns"; value: string }
  | { kind: "host"; value: string };

export interface MiniCandidate {
  address: CandidateAddress;
  port: number;
}

export interface MiniSdp {
  ufrag: string;
  pwd: string;
  /** SHA-256 certificate fingerprint, 32 bytes. */
  fingerprint: Uint8Array;
  setup: DtlsSetup;
  candidates: MiniCandidate[];
}

const MDNS = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.local$/i;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

function classify(address: string): CandidateAddress {
  if (IPV4.test(address)) return { kind: "ipv4", value: address };
  if (MDNS.test(address)) return { kind: "mdns", value: address.toLowerCase() };
  if (address.includes(":")) return { kind: "ipv6", value: address };
  return { kind: "host", value: address };
}

/** Pulls the essentials out of an SDP, or returns null if it isn't the simple shape we expect. */
export function minify(sdp: string): MiniSdp | null {
  const lines = sdp.split(/\r?\n/);
  const value = (prefix: string) =>
    lines
      .find((l) => l.startsWith(prefix))
      ?.slice(prefix.length)
      .trim();
  if (lines.filter((l) => l.startsWith("m=")).length !== 1 || !value("m=application")) return null;

  const ufrag = value("a=ice-ufrag:");
  const pwd = value("a=ice-pwd:");
  const fp = value("a=fingerprint:");
  const setup = value("a=setup:") as DtlsSetup | undefined;
  if (!ufrag || !pwd || !fp || !setup || !["actpass", "active", "passive"].includes(setup)) return null;

  const [algo, hex] = fp.split(" ");
  if (algo?.toLowerCase() !== "sha-256" || !hex) return null;
  const bytes = hex.split(":").map((h) => parseInt(h, 16));
  if (bytes.length !== 32 || bytes.some((b) => Number.isNaN(b))) return null;

  const candidates: MiniCandidate[] = [];
  for (const l of lines) {
    if (!l.startsWith("a=candidate:")) continue;
    // a=candidate:<foundation> <component> <protocol> <priority> <address> <port> typ <type> …
    const parts = l.slice("a=candidate:".length).split(" ");
    const [, component, protocol, , address, port, , type] = parts;
    if (component !== "1" || protocol?.toLowerCase() !== "udp" || type !== "host" || !address || !port) continue;
    const c = { address: classify(address), port: Number(port) };
    if (!candidates.some((x) => x.address.value === c.address.value && x.port === c.port)) candidates.push(c);
  }
  return { ufrag, pwd, fingerprint: Uint8Array.from(bytes), setup, candidates };
}

/** Rebuilds a standard data-channel SDP from the essentials. */
export function expand(mini: MiniSdp): string {
  const fp = [...mini.fingerprint].map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(":");
  const candidates = mini.candidates.map(
    (c, i) => `a=candidate:${i + 1} 1 udp ${2113937151 - i} ${c.address.value} ${c.port} typ host generation 0`,
  );
  return [
    "v=0",
    "o=- 1 2 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "a=group:BUNDLE 0",
    "a=msid-semantic: WMS",
    "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
    "c=IN IP4 0.0.0.0",
    ...candidates,
    "a=end-of-candidates",
    `a=ice-ufrag:${mini.ufrag}`,
    `a=ice-pwd:${mini.pwd}`,
    `a=fingerprint:sha-256 ${fp}`,
    `a=setup:${mini.setup}`,
    "a=mid:0",
    "a=sctp-port:5000",
    "a=max-message-size:262144",
    "",
  ].join("\r\n");
}

// ---- IP address packing -------------------------------------------------------------------

export function ipv4ToBytes(ip: string): number[] {
  return ip.split(".").map(Number);
}

export function ipv6ToBytes(ip: string): number[] {
  const clean = ip.replace(/^\[|\]$/g, "").split("%")[0]!;
  const [head, tail] = clean.includes("::") ? clean.split("::") : [clean, undefined];
  const h = head ? head.split(":") : [];
  const t = tail !== undefined && tail !== "" ? tail.split(":") : [];
  const groups = tail === undefined ? h : [...h, ...Array(8 - h.length - t.length).fill("0"), ...t];
  if (groups.length !== 8) throw new Error(`Bad IPv6 address: ${ip}`);
  return groups.flatMap((g) => {
    const n = parseInt(g, 16);
    return [n >> 8, n & 0xff];
  });
}

export function bytesToIpv6(b: number[]): string {
  const groups: string[] = [];
  for (let i = 0; i < 16; i += 2) groups.push(((b[i]! << 8) | b[i + 1]!).toString(16));
  return groups.join(":");
}

export function uuidToBytes(name: string): number[] {
  const hex = name.slice(0, 36).replace(/-/g, "");
  return Array.from({ length: 16 }, (_, i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16));
}

export function bytesToMdns(b: number[]): string {
  const hex = b.map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}.local`;
}
