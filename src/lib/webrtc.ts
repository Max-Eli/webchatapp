// Default ICE servers used if /api/ice doesn't return custom ones.
// Includes free public TURN (Open Relay Project) so calls work across
// strict NATs without any signup. Best-effort — for reliable production
// use, configure METERED_API_KEY + METERED_APP_NAME to mint your own.
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
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
