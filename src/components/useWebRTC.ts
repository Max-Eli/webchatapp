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
  | "room_full"
  | "ended"
  | "config_error";

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

  const peerIdRef = useRef<string>("");
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const otherPeerIdRef = useRef<string | null>(null);
  const isOffererRef = useRef<boolean>(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const startedRef = useRef<boolean>(false);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);

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
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
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
      setRemoteStream(e.streams[0] ?? null);
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "connected") setStatus("connected");
      else if (s === "failed") {
        // Connection failed — likely NAT/firewall. Surface it.
        setStatus("peer_left");
      }
    };
    return pc;
  }, [sendBroadcast]);

  const initiateOffer = useCallback(async () => {
    if (!localStreamRef.current || !otherPeerIdRef.current) return;
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

    const channel = supabase.channel(`room:${optsRef.current.roomId}`, {
      config: {
        presence: { key: peerIdRef.current },
        broadcast: { self: false, ack: false },
      },
    });
    channelRef.current = channel;

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const peers = Object.keys(state);

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
      if (others.length === 0) {
        if (otherPeerIdRef.current) {
          tearDownPeer();
          setStatus("peer_left");
        } else {
          setStatus("waiting");
        }
        return;
      }

      const target = others[0];
      if (!otherPeerIdRef.current) {
        otherPeerIdRef.current = target;
        isOffererRef.current = peerIdRef.current < target;
        setStatus("connecting");
        if (isOffererRef.current) {
          void initiateOffer();
        }
      }
    });

    channel.on("broadcast", { event: "offer" }, ({ payload }) => {
      const p = payload as IncomingPayload;
      if (p.to !== peerIdRef.current) return;
      void handleOffer(
        p.sdp as RTCSessionDescriptionInit,
        p.from as string
      );
    });
    channel.on("broadcast", { event: "answer" }, ({ payload }) => {
      const p = payload as IncomingPayload;
      if (p.to !== peerIdRef.current) return;
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
      if (state === "SUBSCRIBED") {
        await channel.track({
          peer_id: peerIdRef.current,
          name: optsRef.current.myName,
          joined_at: Date.now(),
        });
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
  };
}
