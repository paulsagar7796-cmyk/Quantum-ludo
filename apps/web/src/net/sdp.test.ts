import { describe, expect, it } from "vitest";
import { decodePairing, encodePairing } from "./codec";
import { bytesToIpv6, expand, ipv6ToBytes, minify } from "./sdp";

const offer = (candidates: string[]) =>
  [
    "v=0",
    "o=- 4611731400430051336 2 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "a=group:BUNDLE 0",
    "a=extmap-allow-mixed",
    "a=msid-semantic: WMS",
    "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
    "c=IN IP4 0.0.0.0",
    ...candidates,
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

const MDNS = [
  "a=candidate:1 1 udp 2113937151 3b1c7c2e-5d0e-4f8e-9e3a-1f2b3c4d5e6f.local 54321 typ host generation 0 network-cost 999",
  "a=candidate:2 1 udp 2113939711 9a8b7c6d-1e2f-4a5b-8c9d-0e1f2a3b4c5d.local 54322 typ host generation 0 network-cost 999",
];
const IPS = [
  "a=candidate:1 1 udp 2113937151 192.168.1.23 60736 typ host generation 0",
  "a=candidate:2 1 udp 2113939711 2409:40e6:3b:999a:a4b8:6fe:d9db:7b69 53566 typ host generation 0",
  "a=candidate:3 1 tcp 1518280447 192.168.1.23 9 typ host tcptype active generation 0",
];

describe("compact SDP", () => {
  it("keeps the connection essentials and drops TCP candidates", () => {
    const m = minify(offer(IPS))!;
    expect(m.ufrag).toBe("aB3d");
    expect(m.pwd).toBe("Zx9yW8vU7tS6rQ5pO4nM3lK2");
    expect(m.setup).toBe("actpass");
    expect(m.fingerprint).toHaveLength(32);
    expect(m.candidates.map((c) => c.address.kind)).toEqual(["ipv4", "ipv6"]);
  });

  it("rebuilds an SDP that minifies to the same essentials", () => {
    for (const cands of [MDNS, IPS]) {
      const m = minify(offer(cands))!;
      expect(minify(expand(m))).toEqual(m);
    }
  });

  it("packs IPv6 addresses, including :: shorthand", () => {
    expect(bytesToIpv6(ipv6ToBytes("2409:40e6:3b:999a:a4b8:6fe:d9db:7b69"))).toBe(
      "2409:40e6:3b:999a:a4b8:6fe:d9db:7b69",
    );
    expect(bytesToIpv6(ipv6ToBytes("fe80::1"))).toBe("fe80:0:0:0:0:0:0:1");
  });
});

describe("QL2 pairing codes", () => {
  it("round-trips offers and answers with every kind of address", async () => {
    for (const cands of [MDNS, IPS]) {
      const sdp = offer(cands);
      const o = await decodePairing(await encodePairing({ k: "offer", sdp, seat: 2, hostName: "Paul" }));
      expect(o).toMatchObject({ k: "offer", seat: 2, hostName: "Paul" });
      expect(minify(o.sdp)).toEqual(minify(sdp));
      const answerSdp = sdp.replace("a=setup:actpass", "a=setup:active");
      const a = await decodePairing(await encodePairing({ k: "answer", sdp: answerSdp, seat: 2, name: "Sam" }));
      expect(a).toMatchObject({ k: "answer", seat: 2, name: "Sam" });
      expect(minify(a.sdp)!.setup).toBe("active");
    }
  });

  it("is short and uses only QR alphanumeric characters", async () => {
    const code = await encodePairing({ k: "offer", sdp: offer(MDNS), seat: 1, hostName: "Paul" });
    expect(code).toMatch(/^QL2\.[A-Z2-7]+$/);
    expect(code.length).toBeLessThan(200);
  });

  it("accepts pasted codes with stray whitespace or lower case", async () => {
    const code = await encodePairing({ k: "answer", sdp: offer(IPS), seat: 1, name: "Sam" });
    const messy = `  ${code.slice(0, 40)}\n${code.slice(40).toLowerCase()} `;
    expect(await decodePairing(messy)).toMatchObject({ k: "answer", name: "Sam" });
  });

  it("falls back to QL1 for descriptions it can't compact, and still decodes them", async () => {
    const odd = offer(MDNS).replace("m=application", "m=audio 9 UDP/TLS/RTP/SAVPF 111\r\nm=application");
    const code = await encodePairing({ k: "offer", sdp: odd, seat: 1, hostName: "Paul" });
    expect(code.startsWith("QL1.")).toBe(true);
    expect((await decodePairing(code)).sdp).toBe(odd);
  });

  it("rejects damaged codes", async () => {
    await expect(decodePairing("QL2.ABC")).rejects.toThrow("damaged");
  });
});
