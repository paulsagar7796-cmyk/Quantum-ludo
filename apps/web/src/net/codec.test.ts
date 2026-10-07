import { describe, expect, it } from "vitest";
import { decodeSignal, encodeSignal } from "./codec";

// A realistic data-channel-only offer, as browsers produce on a local network.
const SDP = [
  "v=0",
  "o=- 4611731400430051336 2 IN IP4 127.0.0.1",
  "s=-",
  "t=0 0",
  "a=group:BUNDLE 0",
  "a=extmap-allow-mixed",
  "a=msid-semantic: WMS",
  "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
  "c=IN IP4 0.0.0.0",
  "a=candidate:1 1 udp 2113937151 3b1c7c2e-5d0e-4f8e-9e3a-1f2b3c4d5e6f.local 54321 typ host generation 0 network-cost 999",
  "a=candidate:2 1 udp 2113939711 9a8b7c6d-1e2f-4a5b-8c9d-0e1f2a3b4c5d.local 54322 typ host generation 0 network-cost 999",
  "a=ice-ufrag:aB3d",
  "a=ice-pwd:Zx9yW8vU7tS6rQ5pO4nM3lK2",
  "a=ice-options:trickle",
  "a=fingerprint:sha-256 0A:1B:2C:3D:4E:5F:60:71:82:93:A4:B5:C6:D7:E8:F9:0A:1B:2C:3D:4E:5F:60:71:82:93:A4:B5:C6:D7:E8:F9",
  "a=setup:actpass",
  "a=mid:0",
  "a=sctp-port:5000",
  "a=max-message-size:262144",
  "",
].join("\r\n");

describe("pairing codes", () => {
  it("round-trips an offer", async () => {
    const payload = { k: "offer", sdp: SDP, seat: 2, hostName: "Paul" };
    const code = await encodeSignal(payload);
    expect(code.startsWith("QL1.")).toBe(true);
    expect(code).toMatch(/^QL1\.[A-Za-z0-9_-]+$/);
    expect(await decodeSignal(code)).toEqual(payload);
  });

  it("is compact enough for a comfortable QR code", async () => {
    const code = await encodeSignal({ k: "offer", sdp: SDP, seat: 1, hostName: "Paul" });
    expect(code.length).toBeLessThan(SDP.length);
    expect(code.length).toBeLessThan(1000);
  });

  it("tolerates surrounding whitespace from copy and paste", async () => {
    const code = await encodeSignal({ k: "answer", sdp: "x", seat: 1, name: "Sam" });
    expect(await decodeSignal(`  ${code}\n`)).toEqual({ k: "answer", sdp: "x", seat: 1, name: "Sam" });
  });

  it("rejects text that is not a code", async () => {
    await expect(decodeSignal("hello")).rejects.toThrow("not a Quantum Ludo code");
    await expect(decodeSignal("QL1.@@@")).rejects.toThrow("damaged");
  });
});
