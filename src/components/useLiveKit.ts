"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConnectionState,
  DisconnectReason,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  Room,
  RoomEvent,
  Track,
} from "livekit-client";
import type { ChatPayload } from "@/lib/chat";

export type Status =
  | "idle"
  | "preparing"
  | "media_error"
  | "connecting"
  | "waiting"
  | "connected"
  | "peer_left"
  | "connection_failed"
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

const log = (...args: unknown[]) => {
  if (typeof window !== "undefined") {
    // eslint-disable-next-line no-console
    console.log("[lingo]", ...args);
  }
};

export function useLiveKit(opts: Options) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [connectionState, setConnectionState] =
    useState<string>("disconnected");
  const [presenceCount, setPresenceCount] = useState<number>(0);

  const identityRef = useRef<string>("");
  if (!identityRef.current && typeof crypto !== "undefined") {
    identityRef.current = crypto.randomUUID();
  }

  const roomRef = useRef<Room | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const otherIdentityRef = useRef<string | null>(null);
  const startedRef = useRef<boolean>(false);

  const refreshLocalStream = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const stream = new MediaStream();
    const cam = room.localParticipant.getTrackPublication(Track.Source.Camera);
    if (cam?.track?.mediaStreamTrack) stream.addTrack(cam.track.mediaStreamTrack);
    const mic = room.localParticipant.getTrackPublication(
      Track.Source.Microphone
    );
    if (mic?.track?.mediaStreamTrack) stream.addTrack(mic.track.mediaStreamTrack);
    localStreamRef.current = stream;
    setLocalStream(stream);
  }, []);

  const ensureRemoteStream = useCallback(() => {
    if (!remoteStreamRef.current) {
      remoteStreamRef.current = new MediaStream();
    }
    return remoteStreamRef.current;
  }, []);

  const handleTrackSubscribed = useCallback(
    (
      track: RemoteTrack,
      _pub: RemoteTrackPublication,
      participant: RemoteParticipant
    ) => {
      log("track subscribed:", track.kind, "from", participant.identity);
      const stream = ensureRemoteStream();
      stream.addTrack(track.mediaStreamTrack);
      // Force a new MediaStream object so React re-renders the <video>
      const fresh = new MediaStream(stream.getTracks());
      remoteStreamRef.current = fresh;
      setRemoteStream(fresh);
    },
    [ensureRemoteStream]
  );

  const handleTrackUnsubscribed = useCallback((track: RemoteTrack) => {
    const stream = remoteStreamRef.current;
    if (!stream) return;
    try {
      stream.removeTrack(track.mediaStreamTrack);
    } catch {
      // ignore
    }
    const fresh = new MediaStream(stream.getTracks());
    remoteStreamRef.current = fresh;
    setRemoteStream(fresh.getTracks().length > 0 ? fresh : null);
  }, []);

  const handleParticipantConnected = useCallback(
    (participant: RemoteParticipant) => {
      log("participant connected:", participant.identity);
      const room = roomRef.current;
      if (!room) return;
      setPresenceCount(room.remoteParticipants.size + 1);

      // Enforce 1-on-1: if more than one remote, leave
      if (room.remoteParticipants.size > 1) {
        log("room over capacity — leaving");
        setStatus("room_full");
        void room.disconnect();
        return;
      }

      otherIdentityRef.current = participant.identity;
      if (participant.name) optsRef.current.onPeerName(participant.name);
      // Status becomes 'connected' when first track is actually subscribed,
      // but participant is here — promote from waiting to connecting.
      setStatus("connecting");
    },
    []
  );

  const handleParticipantDisconnected = useCallback(
    (participant: RemoteParticipant) => {
      log("participant disconnected:", participant.identity);
      const room = roomRef.current;
      if (room) setPresenceCount(room.remoteParticipants.size + 1);

      if (otherIdentityRef.current === participant.identity) {
        otherIdentityRef.current = null;
        remoteStreamRef.current = null;
        setRemoteStream(null);
        setStatus("peer_left");
      }
    },
    []
  );

  const handleDataReceived = useCallback(
    (payload: Uint8Array, participant?: RemoteParticipant) => {
      if (!participant) return;
      try {
        const text = new TextDecoder().decode(payload);
        const msg = JSON.parse(text) as ChatPayload;
        if (msg && typeof msg.text === "string") {
          optsRef.current.onIncomingMessage(msg);
        }
      } catch {
        // ignore malformed
      }
    },
    []
  );

  const handleConnectionStateChanged = useCallback((state: ConnectionState) => {
    log("connection state:", state);
    setConnectionState(state);
    if (state === ConnectionState.Connected) {
      const room = roomRef.current;
      if (!room) return;
      setPresenceCount(room.remoteParticipants.size + 1);
      // If a remote participant is already present + has tracks, we're connected.
      // Otherwise we're waiting.
      if (
        room.remoteParticipants.size >= 1 &&
        Array.from(room.remoteParticipants.values()).some(
          (p) => p.trackPublications.size > 0
        )
      ) {
        setStatus("connected");
      } else if (room.remoteParticipants.size === 0) {
        setStatus("waiting");
      }
    } else if (state === ConnectionState.Reconnecting) {
      setStatus("connecting");
    }
  }, []);

  const handleDisconnected = useCallback((reason?: DisconnectReason) => {
    log("disconnected:", reason);
    // Don't override room_full or ended
    setStatus((s) => {
      if (s === "room_full" || s === "ended") return s;
      if (
        reason === DisconnectReason.SERVER_SHUTDOWN ||
        reason === DisconnectReason.PARTICIPANT_REMOVED
      ) {
        return "ended";
      }
      return "connection_failed";
    });
    setRemoteStream(null);
    remoteStreamRef.current = null;
    otherIdentityRef.current = null;
  }, []);

  // Promote 'waiting'→'connected' when remote tracks finally arrive
  useEffect(() => {
    if (remoteStream && status !== "connected") {
      setStatus("connected");
    }
  }, [remoteStream, status]);

  const cleanup = useCallback(async () => {
    const room = roomRef.current;
    if (room) {
      room.removeAllListeners();
      try {
        await room.disconnect();
      } catch {
        // ignore
      }
    }
    roomRef.current = null;
    if (localStreamRef.current) {
      // LiveKit manages local tracks internally; disconnect stops them.
      // Just clear our copy.
      localStreamRef.current = null;
    }
    setLocalStream(null);
    remoteStreamRef.current = null;
    setRemoteStream(null);
    otherIdentityRef.current = null;
    startedRef.current = false;
  }, []);

  const start = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setStatus("preparing");
    setError(null);

    // 1. Fetch a LiveKit token from our server
    let url: string;
    let token: string;
    try {
      const resp = await fetch("/api/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          room: optsRef.current.roomId,
          identity: identityRef.current,
          name: optsRef.current.myName,
        }),
      });
      const data = (await resp.json()) as {
        token?: string;
        url?: string;
        error?: string;
      };
      if (!resp.ok || !data.token || !data.url) {
        throw new Error(data.error ?? `token fetch failed (${resp.status})`);
      }
      token = data.token;
      url = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not get access token");
      setStatus("config_error");
      startedRef.current = false;
      return;
    }

    // 2. Build the room and wire events
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      publishDefaults: {
        videoSimulcastLayers: undefined,
      },
    });
    roomRef.current = room;

    room
      .on(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged)
      .on(RoomEvent.Disconnected, handleDisconnected)
      .on(RoomEvent.ParticipantConnected, handleParticipantConnected)
      .on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected)
      .on(RoomEvent.TrackSubscribed, handleTrackSubscribed)
      .on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed)
      .on(RoomEvent.DataReceived, handleDataReceived)
      .on(RoomEvent.LocalTrackPublished, () => refreshLocalStream())
      .on(RoomEvent.LocalTrackUnpublished, () => refreshLocalStream());

    // 3. Connect
    setStatus("connecting");
    try {
      await room.connect(url, token);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not connect to LiveKit"
      );
      setStatus("connection_failed");
      void cleanup();
      return;
    }

    // 4. Enforce max 2 participants (we're the 2nd or earlier)
    if (room.remoteParticipants.size > 1) {
      log("room is full on connect — leaving");
      setStatus("room_full");
      void room.disconnect();
      return;
    }

    // 5. Track existing participant if any (we're the 2nd to join)
    if (room.remoteParticipants.size === 1) {
      const other = Array.from(room.remoteParticipants.values())[0];
      otherIdentityRef.current = other.identity;
      if (other.name) optsRef.current.onPeerName(other.name);
    }

    // 6. Enable camera + microphone
    try {
      await room.localParticipant.enableCameraAndMicrophone();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not access camera or microphone"
      );
      setStatus("media_error");
      void cleanup();
      return;
    }
    refreshLocalStream();
    setPresenceCount(room.remoteParticipants.size + 1);
  }, [
    cleanup,
    handleConnectionStateChanged,
    handleDataReceived,
    handleDisconnected,
    handleParticipantConnected,
    handleParticipantDisconnected,
    handleTrackSubscribed,
    handleTrackUnsubscribed,
    refreshLocalStream,
  ]);

  const sendMessage = useCallback((text: string): ChatPayload | null => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return null;
    if (room.remoteParticipants.size === 0) return null;
    const payload: ChatPayload = {
      id: crypto.randomUUID(),
      text,
      lang: optsRef.current.myLang,
      name: optsRef.current.myName,
      ts: Date.now(),
    };
    try {
      const data = new TextEncoder().encode(JSON.stringify(payload));
      void room.localParticipant.publishData(data, { reliable: true });
      return payload;
    } catch {
      return null;
    }
  }, []);

  const toggleMic = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    setMicEnabled((prev) => {
      const next = !prev;
      void room.localParticipant.setMicrophoneEnabled(next);
      return next;
    });
  }, []);

  const toggleCam = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    setCamEnabled((prev) => {
      const next = !prev;
      void room.localParticipant.setCameraEnabled(next);
      return next;
    });
  }, []);

  const hangup = useCallback(() => {
    setStatus("ended");
    void cleanup();
  }, [cleanup]);

  useEffect(() => {
    return () => {
      void cleanup();
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
    diag: {
      peerId: identityRef.current,
      otherPeerId: otherIdentityRef.current,
      channelState: connectionState,
      presenceCount,
      iceState: "—",
      pcState: connectionState,
      iceSource: "livekit",
    },
  };
}
