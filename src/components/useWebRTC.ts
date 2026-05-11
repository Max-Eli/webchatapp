"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { ICE_SERVERS, type ChatPayload } from "@/lib/webrtc";

export type Status =
  | "idle"
  | "preparing"
  | "media_error"
  | "waiting"
  | "connecting"
  | "connected"
  | "peer_left"
  | "connection_failed"
  | "room_full"
  | "ended"
  | "config_error";

const log = (...args: unknown[]) => {
  if (typeof window !== "undefined") {
    // eslint-disable-next-line no-console
    console.log("[lingo]", ...args);
  }
};

type Options = {
  roomId: string;
  myName: string;
  myLang: string;
  onIncomingMessage: (msg: ChatPayload) => void;
  onPeerName: (name: string) => void;
};

type IncomingPayload = Record<string, unknown>;

export function useWebRTC(opts: Options) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [channelState, setChannelState] = useState<string>("idle");
  const [presenceCount, setPresenceCount] = useState<number>(0);
  const [iceState, setIceState] = useState<string>("new");
  const [pcState, setPcState] = useState<string>("new");

  const peerIdRef = useRef<string>("");
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const otherPeerIdRef = useRef<string | null>(null);
  const isOffererRef = useRef<boolean>(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const startedRef = useRef<boolean>(false);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const iceServersRef = useRef<RTCIceServer[]>(ICE_SERVERS);
  const [iceSource, setIceSource] = useState<string>("default");

  if (!peerIdRef.current && typeof crypto !== "undefined") {
    peerIdRef.current = crypto.randomUUID();
  }

  const sendBroadcast = useCallback(
    async (event: string, payload: Record<string, unknown>) => {
      const ch = channelRef.current;
      if (!ch) return;
      await ch.send({ type: "broadcast", event, payload });
    },
    []
  );

  const setupDataChannel = useCallback((dc: RTCDataChannel) => {
    dc.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as ChatPayload;
        if (data && typeof data.text === "string") {
          optsRef.current.onIncomingMessage(data);
        }
      } catch {
        // ignore malformed
      }
    };
  }, []);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
    pc.onicecandidate = (e) => {
      const other = otherPeerIdRef.current;
      if (e.candidate && other) {
        void sendBroadcast("ice", {
          candidate: e.candidate.toJSON(),
          from: peerIdRef.current,
          to: other,
        });
      }
    };
    pc.ontrack = (e) => {
      log("ontrack", e.track.kind);
      setRemoteStream(e.streams[0] ?? null);
    };
    pc.oniceconnectionstatechange = () => {
      log("ice state:", pc.iceConnectionState);
      setIceState(pc.iceConnectionState);
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      log("pc state:", s);
      setPcState(s);
      if (s === "connected") setStatus("connected");
      else if (s === "failed") {
        setStatus("connection_failed");
        setError(
          "Could not establish a direct connection. This usually means a firewall or strict NAT — a TURN server may be required."
        );
      }
    };
    return pc;
  }, [sendBroadcast]);

  const initiateOffer = useCallback(async () => {
    if (!localStreamRef.current || !otherPeerIdRef.current) return;
    log("creating offer for", otherPeerIdRef.current);
    const pc = createPeerConnection();
    pcRef.current = pc;
    const dc = pc.createDataChannel("chat", { ordered: true });
    setupDataChannel(dc);
    dcRef.current = dc;
    for (const track of localStreamRef.current.getTracks()) {
      pc.addTrack(track, localStreamRef.current);
    }
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendBroadcast("offer", {
      sdp: offer,
      from: peerIdRef.current,
      to: otherPeerIdRef.current,
    });
    await sendBroadcast("name", {
      name: optsRef.current.myName,
      from: peerIdRef.current,
      to: otherPeerIdRef.current,
    });
    log("offer sent");
  }, [createPeerConnection, sendBroadcast, setupDataChannel]);

  const handleOffer = useCallback(
    async (sdp: RTCSessionDescriptionInit, from: string) => {
      if (!localStreamRef.current) return;
      otherPeerIdRef.current = from;
      const pc = createPeerConnection();
      pcRef.current = pc;
      pc.ondatachannel = (e) => {
        dcRef.current = e.channel;
        setupDataChannel(e.channel);
      };
      for (const track of localStreamRef.current.getTracks()) {
        pc.addTrack(track, localStreamRef.current);
      }
      await pc.setRemoteDescription(sdp);
      // Drain any queued ICE
      for (const c of pendingIceRef.current) {
        try {
          await pc.addIceCandidate(c);
        } catch {
          // ignore
        }
      }
      pendingIceRef.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendBroadcast("answer", {
        sdp: answer,
        from: peerIdRef.current,
        to: from,
      });
      await sendBroadcast("name", {
        name: optsRef.current.myName,
        from: peerIdRef.current,
        to: from,
      });
      log("answer sent");
    },
    [createPeerConnection, sendBroadcast, setupDataChannel]
  );

  const handleAnswer = useCallback(
    async (sdp: RTCSessionDescriptionInit) => {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(sdp);
      for (const c of pendingIceRef.current) {
        try {
          await pc.addIceCandidate(c);
        } catch {
          // ignore
        }
      }
      pendingIceRef.current = [];
    },
    []
  );

  const handleIce = useCallback(async (candidate: RTCIceCandidateInit) => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) {
      pendingIceRef.current.push(candidate);
      return;
    }
    try {
      await pc.addIceCandidate(candidate);
    } catch {
      // ignore
    }
  }, []);

  const tearDownPeer = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.ondatachannel = null;
      pcRef.current.close();
    }
    pcRef.current = null;
    if (dcRef.current) {
      dcRef.current.onmessage = null;
      try {
        dcRef.current.close();
      } catch {
        // ignore
      }
    }
    dcRef.current = null;
    setRemoteStream(null);
    otherPeerIdRef.current = null;
    pendingIceRef.current = [];
  }, []);

  const cleanup = useCallback(() => {
    tearDownPeer();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    localStreamRef.current = null;
    setLocalStream(null);
    if (channelRef.current) {
      try {
        channelRef.current.unsubscribe();
      } catch {
        // ignore
      }
      try {
        getSupabase().removeChannel(channelRef.current);
      } catch {
        // ignore
      }
    }
    channelRef.current = null;
    startedRef.current = false;
  }, [tearDownPeer]);

  const start = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setStatus("preparing");
    setError(null);

    let supabase;
    try {
      supabase = getSupabase();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Supabase not configured");
      setStatus("config_error");
      startedRef.current = false;
      return;
    }

    // Fetch ICE servers (may include freshly-minted TURN creds)
    try {
      const r = await fetch("/api/ice");
      if (r.ok) {
        const data = (await r.json()) as {
          iceServers?: RTCIceServer[];
          source?: string;
        };
        if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
          iceServersRef.current = data.iceServers;
          setIceSource(data.source ?? "unknown");
          log(
            "ice servers from",
            data.source,
            "(",
            data.iceServers.length,
            "entries)"
          );
        }
      }
    } catch {
      log("ice fetch failed, using defaults");
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not access camera or microphone"
      );
      setStatus("media_error");
      startedRef.current = false;
      return;
    }
    localStreamRef.current = stream;
    setLocalStream(stream);

    const channel = supabase.channel(`room-${optsRef.current.roomId}`, {
      config: {
        presence: { key: peerIdRef.current },
        broadcast: { self: false, ack: false },
      },
    });
    channelRef.current = channel;

    const tryStartWith = (target: string) => {
      if (otherPeerIdRef.current) return;
      otherPeerIdRef.current = target;
      isOffererRef.current = peerIdRef.current < target;
      log(
        "peer paired:",
        target,
        "(I'm",
        isOffererRef.current ? "offerer)" : "answerer)"
      );
      setStatus("connecting");
      if (isOffererRef.current) {
        void initiateOffer();
      }
    };

    // Use sync only for initial state + room-full check.
    // Use join/leave for definitive peer changes.
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const peers = Object.keys(state);
      log("presence sync:", peers);
      setPresenceCount(peers.length);

      if (peers.length > 2) {
        const sorted = [...peers].sort();
        const allowed = sorted.slice(0, 2);
        if (!allowed.includes(peerIdRef.current)) {
          setStatus("room_full");
          cleanup();
          return;
        }
      }

      const others = peers.filter((p) => p !== peerIdRef.current);
      if (others.length === 0 && !otherPeerIdRef.current) {
        setStatus("waiting");
        return;
      }
      if (others.length > 0 && !otherPeerIdRef.current) {
        tryStartWith(others[0]);
      }
    });

    channel.on("presence", { event: "join" }, ({ key }) => {
      if (key === peerIdRef.current) return;
      log("presence join:", key);
      tryStartWith(key);
    });

    channel.on("presence", { event: "leave" }, ({ key }) => {
      if (key === peerIdRef.current) return;
      log("presence leave:", key);
      if (otherPeerIdRef.current === key) {
        tearDownPeer();
        setStatus("peer_left");
      }
    });

    channel.on("broadcast", { event: "offer" }, ({ payload }) => {
      const p = payload as IncomingPayload;
      if (p.to !== peerIdRef.current) return;
      log("recv offer from", p.from);
      void handleOffer(
        p.sdp as RTCSessionDescriptionInit,
        p.from as string
      );
    });
    channel.on("broadcast", { event: "answer" }, ({ payload }) => {
      const p = payload as IncomingPayload;
      if (p.to !== peerIdRef.current) return;
      log("recv answer");
      void handleAnswer(p.sdp as RTCSessionDescriptionInit);
    });
    channel.on("broadcast", { event: "ice" }, ({ payload }) => {
      const p = payload as IncomingPayload;
      if (p.to !== peerIdRef.current) return;
      void handleIce(p.candidate as RTCIceCandidateInit);
    });
    channel.on("broadcast", { event: "name" }, ({ payload }) => {
      const p = payload as IncomingPayload;
      if (p.to !== peerIdRef.current) return;
      if (typeof p.name === "string") {
        optsRef.current.onPeerName(p.name);
      }
    });

    await channel.subscribe(async (state) => {
      log("channel state:", state);
      setChannelState(state);
      if (state === "SUBSCRIBED") {
        const trackResult = await channel.track({
          peer_id: peerIdRef.current,
          name: optsRef.current.myName,
          joined_at: Date.now(),
        });
        log("track result:", trackResult);
      } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
        setError("Could not connect to signaling server");
        setStatus("config_error");
      }
    });
  }, [cleanup, handleAnswer, handleIce, handleOffer, initiateOffer, tearDownPeer]);

  const sendMessage = useCallback((text: string): ChatPayload | null => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== "open") return null;
    const payload: ChatPayload = {
      id: crypto.randomUUID(),
      text,
      lang: optsRef.current.myLang,
      name: optsRef.current.myName,
      ts: Date.now(),
    };
    try {
      dc.send(JSON.stringify(payload));
      return payload;
    } catch {
      return null;
    }
  }, []);

  const toggleMic = useCallback(() => {
    const tracks = localStreamRef.current?.getAudioTracks() ?? [];
    setMicEnabled((prev) => {
      const next = !prev;
      tracks.forEach((t) => (t.enabled = next));
      return next;
    });
  }, []);

  const toggleCam = useCallback(() => {
    const tracks = localStreamRef.current?.getVideoTracks() ?? [];
    setCamEnabled((prev) => {
      const next = !prev;
      tracks.forEach((t) => (t.enabled = next));
      return next;
    });
  }, []);

  const hangup = useCallback(() => {
    cleanup();
    setStatus("ended");
  }, [cleanup]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    status,
    error,
    localStream,
    remoteStream,
    micEnabled,
    camEnabled,
    start,
    sendMessage,
    toggleMic,
    toggleCam,
    hangup,
    chatReady: dcRef.current?.readyState === "open",
    diag: {
      peerId: peerIdRef.current,
      otherPeerId: otherPeerIdRef.current,
      channelState,
      presenceCount,
      iceState,
      pcState,
      iceSource,
    },
  };
}
