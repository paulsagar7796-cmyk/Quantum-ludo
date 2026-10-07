import { decodePairing, encodePairing } from "./codec";
import type { AnswerPayload, OfferPayload } from "./protocol";

/**
 * Direct device-to-device connections over the local network (WebRTC data channels).
 * No signalling server: offers and answers travel as pairing codes (QR or text), and
 * no STUN/TURN servers, so it works on a Wi-Fi network or phone hotspot with no internet.
 */

const ICE_TIMEOUT_MS = 4000;

function newConnection(): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers: [] });
}

/** Codes carry the whole description, so wait until all local network candidates are in it. */
function gatherCandidates(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", check);
      resolve();
    };
    const check = () => pc.iceGatheringState === "complete" && done();
    const timer = setTimeout(done, ICE_TIMEOUT_MS);
    pc.addEventListener("icegatheringstatechange", check);
  });
}

export interface HostInvite {
  pc: RTCPeerConnection;
  channel: RTCDataChannel;
  code: string;
}

/** Host side, step 1: create an invite for one seat. */
export async function createInvite(seat: number, hostName: string): Promise<HostInvite> {
  const pc = newConnection();
  const channel = pc.createDataChannel("game", { ordered: true });
  await pc.setLocalDescription(await pc.createOffer());
  await gatherCandidates(pc);
  const payload: OfferPayload = { k: "offer", sdp: pc.localDescription!.sdp, seat, hostName };
  return { pc, channel, code: await encodePairing(payload) };
}

/** Host side, step 2: accept the guest's reply code. Returns the guest's name. */
export async function acceptReply(invite: HostInvite, replyCode: string, seat: number): Promise<string> {
  const reply = await decodePairing(replyCode);
  if (reply.k !== "answer") throw new Error("That is an invite code. Scan the reply shown on the guest's screen.");
  if (reply.seat !== seat) throw new Error("That reply belongs to a different seat.");
  await invite.pc.setRemoteDescription({ type: "answer", sdp: reply.sdp });
  return reply.name;
}

export interface GuestJoin {
  pc: RTCPeerConnection;
  /** Resolves when the host's data channel arrives. */
  channel: Promise<RTCDataChannel>;
  code: string;
  seat: number;
  hostName: string;
}

/** Guest side: read the host's invite and produce the reply code. */
export async function answerInvite(inviteCode: string, name: string): Promise<GuestJoin> {
  const offer = await decodePairing(inviteCode);
  if (offer.k !== "offer") throw new Error("That is a reply code. Scan the invite on the host's screen.");
  const pc = newConnection();
  const channel = new Promise<RTCDataChannel>((resolve) => {
    pc.addEventListener("datachannel", (e) => resolve(e.channel), { once: true });
  });
  await pc.setRemoteDescription({ type: "offer", sdp: offer.sdp });
  await pc.setLocalDescription(await pc.createAnswer());
  await gatherCandidates(pc);
  const payload: AnswerPayload = { k: "answer", sdp: pc.localDescription!.sdp, seat: offer.seat, name };
  return { pc, channel, code: await encodePairing(payload), seat: offer.seat, hostName: offer.hostName };
}

/** Resolves when the channel is open, rejects if it closes or times out first. */
export function whenOpen(channel: RTCDataChannel, timeoutMs = 60_000): Promise<RTCDataChannel> {
  if (channel.readyState === "open") return Promise.resolve(channel);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Connection timed out.")), timeoutMs);
    channel.addEventListener("open", () => (clearTimeout(timer), resolve(channel)), { once: true });
    channel.addEventListener("close", () => (clearTimeout(timer), reject(new Error("Connection closed."))), {
      once: true,
    });
  });
}

/**
 * A data channel that buffers incoming messages until someone subscribes, so nothing sent
 * the moment the channel opens is lost while the screen that handles it is still mounting.
 */
export interface Link {
  send: (data: string) => void;
  subscribe: (fn: (data: string) => void) => () => void;
  onClose: (fn: () => void) => () => void;
  isOpen: () => boolean;
  close: () => void;
}

export function makeLink(channel: RTCDataChannel): Link {
  const buffer: string[] = [];
  const subscribers = new Set<(data: string) => void>();
  channel.addEventListener("message", (e) => {
    if (typeof e.data !== "string") return;
    if (subscribers.size === 0) buffer.push(e.data);
    else for (const fn of subscribers) fn(e.data);
  });
  return {
    send: (data) => channel.readyState === "open" && channel.send(data),
    subscribe(fn) {
      subscribers.add(fn);
      for (const data of buffer.splice(0)) fn(data);
      return () => subscribers.delete(fn);
    },
    onClose(fn) {
      channel.addEventListener("close", fn);
      return () => channel.removeEventListener("close", fn);
    },
    isOpen: () => channel.readyState === "open",
    close: () => channel.close(),
  };
}
