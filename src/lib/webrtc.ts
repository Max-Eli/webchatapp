export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478" },
];

export type SignalMessage =
  | { kind: "offer"; sdp: RTCSessionDescriptionInit; from: string }
  | { kind: "answer"; sdp: RTCSessionDescriptionInit; from: string }
  | { kind: "ice"; candidate: RTCIceCandidateInit; from: string }
  | { kind: "hello"; from: string }
  | { kind: "bye"; from: string };

export type ChatPayload = {
  id: string;
  text: string;
  lang: string;
  name: string;
  ts: number;
};
