"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Copy,
  Mic,
  MicOff,
  PhoneOff,
  Video,
  VideoOff,
  Languages,
} from "lucide-react";
import { Button } from "@/components/Button";
import { LanguageSelect } from "@/components/LanguageSelect";
import { ChatPanel } from "@/components/ChatPanel";
import { VideoTile } from "@/components/VideoTile";
import { type ChatMessage } from "@/components/Message";
import { useWebRTC } from "@/components/useWebRTC";
import { cn } from "@/lib/cn";
import type { ChatPayload } from "@/lib/webrtc";

const NAME_KEY = "lingo.name";
const LANG_KEY = "lingo.lang";

function loadName(): string {
  if (typeof window === "undefined") return "Guest";
  const stored = localStorage.getItem(NAME_KEY);
  if (stored) return stored;
  const suffix = Math.floor(Math.random() * 9000 + 1000);
  return `Guest ${suffix}`;
}

function loadLang(): string {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem(LANG_KEY);
  if (stored) return stored;
  const nav = (typeof navigator !== "undefined" && navigator.language) || "en";
  return nav.split("-")[0].toLowerCase();
}

export function RoomClient({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"lobby" | "in-call">("lobby");
  const [name, setName] = useState<string>("");
  const [lang, setLang] = useState<string>("en");
  const [peerName, setPeerName] = useState<string>("Friend");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);

  const translationCacheRef = useRef<Map<string, string>>(new Map());
  const inFlightRef = useRef<Set<string>>(new Set());
  const seenIdsRef = useRef<Set<string>>(new Set());

  // Hydrate name/lang on mount
  useEffect(() => {
    setName(loadName());
    setLang(loadLang());
  }, []);

  useEffect(() => {
    if (name && typeof window !== "undefined") {
      localStorage.setItem(NAME_KEY, name);
    }
  }, [name]);
  useEffect(() => {
    if (lang && typeof window !== "undefined") {
      localStorage.setItem(LANG_KEY, lang);
    }
  }, [lang]);

  const handleIncoming = useCallback((p: ChatPayload) => {
    setMessages((prev) => [
      ...prev,
      {
        id: p.id,
        text: p.text,
        sourceLang: p.lang,
        name: p.name || "Friend",
        ts: p.ts,
        mine: false,
        translating: false,
        translated: undefined,
      },
    ]);
  }, []);

  const handlePeerName = useCallback((n: string) => {
    setPeerName(n || "Friend");
  }, []);

  const rtc = useWebRTC({
    roomId,
    myName: name || "Guest",
    myLang: lang,
    onIncomingMessage: handleIncoming,
    onPeerName: handlePeerName,
  });

  // Translate any messages that need it for current language
  useEffect(() => {
    if (!lang) return;
    for (const m of messages) {
      if (m.mine) continue;
      if (m.sourceLang === lang) continue;
      const cacheKey = `${m.sourceLang}::${lang}::${m.text}`;
      const cached = translationCacheRef.current.get(cacheKey);
      if (cached) {
        if (m.translated !== cached) {
          setMessages((prev) =>
            prev.map((x) =>
              x.id === m.id
                ? {
                    ...x,
                    translated: cached,
                    translating: false,
                    translationError: false,
                  }
                : x
            )
          );
        }
        continue;
      }
      // Skip if already translated to current language
      // We can detect this by tracking the lang we translated to;
      // simplest: re-translate whenever cached miss.
      const inFlightKey = `${m.id}::${lang}`;
      if (inFlightRef.current.has(inFlightKey)) continue;
      inFlightRef.current.add(inFlightKey);

      setMessages((prev) =>
        prev.map((x) =>
          x.id === m.id
            ? { ...x, translating: true, translationError: false }
            : x
        )
      );

      fetch("/api/translate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: m.text,
          source: m.sourceLang,
          target: lang,
        }),
      })
        .then(async (r) => {
          if (!r.ok) throw new Error(await r.text());
          return r.json() as Promise<{ translated: string }>;
        })
        .then((d) => {
          translationCacheRef.current.set(cacheKey, d.translated);
          setMessages((prev) =>
            prev.map((x) =>
              x.id === m.id
                ? {
                    ...x,
                    translated: d.translated,
                    translating: false,
                    translationError: false,
                  }
                : x
            )
          );
        })
        .catch(() => {
          setMessages((prev) =>
            prev.map((x) =>
              x.id === m.id
                ? { ...x, translating: false, translationError: true }
                : x
            )
          );
        })
        .finally(() => {
          inFlightRef.current.delete(inFlightKey);
        });
    }
  }, [messages, lang]);

  // Track unread when chat closed
  useEffect(() => {
    if (chatOpen) {
      setUnread(0);
      messages.forEach((m) => seenIdsRef.current.add(m.id));
      return;
    }
    let added = 0;
    for (const m of messages) {
      if (seenIdsRef.current.has(m.id)) continue;
      seenIdsRef.current.add(m.id);
      if (!m.mine) added += 1;
    }
    if (added > 0) setUnread((u) => u + added);
  }, [messages, chatOpen]);

  function handleSendChat(text: string) {
    const payload = rtc.sendMessage(text);
    if (!payload) return;
    setMessages((prev) => [
      ...prev,
      {
        id: payload.id,
        text: payload.text,
        sourceLang: payload.lang,
        name: payload.name,
        ts: payload.ts,
        mine: true,
      },
    ]);
  }

  async function copyLink() {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  function joinCall() {
    setPhase("in-call");
    void rtc.start();
  }

  function endCall() {
    rtc.hangup();
    router.push("/");
  }

  const statusLabel = useMemo(() => {
    switch (rtc.status) {
      case "preparing":
        return "Preparing camera…";
      case "waiting":
        return "Waiting for your friend to join";
      case "connecting":
        return "Connecting…";
      case "connected":
        return peerName;
      case "peer_left":
        return "Your friend left — waiting…";
      case "room_full":
        return "Room is full";
      case "media_error":
        return "Camera or mic blocked";
      case "config_error":
        return "Signaling not configured";
      case "ended":
        return "Call ended";
      default:
        return "Idle";
    }
  }, [rtc.status, peerName]);

  if (phase === "lobby") {
    return (
      <Lobby
        roomId={roomId}
        name={name}
        setName={setName}
        lang={lang}
        setLang={setLang}
        onJoin={joinCall}
        onCopyLink={copyLink}
        linkCopied={linkCopied}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col overflow-hidden">
      {/* Remote video full-bleed */}
      <div className="absolute inset-0">
        {rtc.remoteStream ? (
          <VideoTile stream={rtc.remoteStream} />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-[var(--bg)]">
            <WaitingArt status={rtc.status} label={statusLabel} />
          </div>
        )}
        {/* Subtle gradient for control legibility */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
      </div>

      {/* Top bar */}
      <div className="relative z-20 flex items-start justify-between p-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <div className="flex flex-col gap-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                rtc.status === "connected"
                  ? "bg-[var(--accent)] pulse-dot"
                  : "bg-amber-400 pulse-dot"
              )}
            />
            <span className="text-[12px] font-medium text-[var(--text)]">
              {statusLabel}
            </span>
          </div>
          <button
            onClick={copyLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors max-w-fit"
          >
            {linkCopied ? <Check size={12} /> : <Copy size={12} />}
            <span className="font-mono tracking-wider">{roomId}</span>
          </button>
        </div>

        <LanguageSelect value={lang} onChange={setLang} compact />
      </div>

      {/* Self preview */}
      <div className="absolute z-20 right-3 top-[calc(env(safe-area-inset-top)+5.5rem)] md:top-6 md:right-6">
        <div className="relative w-[110px] h-[148px] md:w-[180px] md:h-[240px] rounded-2xl overflow-hidden glass shadow-2xl shadow-black/50">
          {rtc.localStream && rtc.camEnabled ? (
            <VideoTile stream={rtc.localStream} muted mirror />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-[var(--surface)]">
              <VideoOff size={20} className="text-[var(--text-dim)]" />
            </div>
          )}
          <div className="absolute bottom-1.5 left-1.5 right-1.5 px-2 py-0.5 rounded-md bg-black/50 text-[10px] text-white truncate">
            You
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="relative z-20 mt-auto flex justify-center pb-[calc(env(safe-area-inset-bottom)+1.25rem)] md:pb-8">
        <div className="flex items-center gap-2 px-3 py-2 rounded-full glass shadow-2xl shadow-black/40">
          <ControlButton
            active={rtc.micEnabled}
            onClick={rtc.toggleMic}
            label={rtc.micEnabled ? "Mute" : "Unmute"}
            iconOn={<Mic size={20} />}
            iconOff={<MicOff size={20} />}
          />
          <ControlButton
            active={rtc.camEnabled}
            onClick={rtc.toggleCam}
            label={rtc.camEnabled ? "Stop video" : "Start video"}
            iconOn={<Video size={20} />}
            iconOff={<VideoOff size={20} />}
          />
          <button
            onClick={endCall}
            className="h-12 px-5 rounded-full bg-[var(--danger)] hover:bg-[#ff5e5e] text-white flex items-center gap-2 font-medium transition-colors active:scale-95"
            aria-label="End call"
          >
            <PhoneOff size={18} />
            <span className="hidden sm:inline text-sm">End</span>
          </button>
        </div>
      </div>

      {/* Chat overlay */}
      <ChatPanel
        messages={messages}
        myLang={lang}
        onLangChange={setLang}
        onSend={handleSendChat}
        open={chatOpen}
        onOpenChange={setChatOpen}
        unread={unread}
        onMarkRead={() => setUnread(0)}
        connected={rtc.status === "connected"}
      />

      {/* Error toasts */}
      <AnimatePresence>
        {rtc.error && (rtc.status === "media_error" || rtc.status === "config_error") && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="fixed z-50 top-4 left-1/2 -translate-x-1/2 max-w-sm mx-4 px-4 py-3 rounded-2xl bg-[var(--danger)]/15 border border-[var(--danger)]/40 text-[var(--text)] text-sm backdrop-blur-md"
          >
            {rtc.error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ControlButton({
  active,
  onClick,
  label,
  iconOn,
  iconOff,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  iconOn: React.ReactNode;
  iconOff: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        "h-12 w-12 rounded-full flex items-center justify-center transition-all active:scale-95",
        active
          ? "bg-white/8 text-[var(--text)] hover:bg-white/12"
          : "bg-[var(--danger)]/90 text-white"
      )}
    >
      {active ? iconOn : iconOff}
    </button>
  );
}

function WaitingArt({ status, label }: { status: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-5 text-center px-6">
      <div className="relative">
        <div className="h-20 w-20 rounded-3xl bg-[var(--surface)] border border-[var(--border-strong)] flex items-center justify-center">
          <Languages size={28} className="text-[var(--accent)]" />
        </div>
        {(status === "waiting" ||
          status === "connecting" ||
          status === "preparing") && (
          <div className="absolute -inset-2 rounded-3xl border border-[var(--accent)]/30 animate-ping" />
        )}
      </div>
      <div>
        <div className="text-[var(--text)] text-[15px] font-medium">
          {label}
        </div>
        <div className="text-[12px] text-[var(--text-dim)] mt-1">
          {status === "waiting" && "Send them the link to join"}
          {status === "connecting" && "Almost there…"}
          {status === "preparing" && "Allow camera & mic when prompted"}
        </div>
      </div>
    </div>
  );
}

function Lobby({
  roomId,
  name,
  setName,
  lang,
  setLang,
  onJoin,
  onCopyLink,
  linkCopied,
}: {
  roomId: string;
  name: string;
  setName: (n: string) => void;
  lang: string;
  setLang: (l: string) => void;
  onJoin: () => void;
  onCopyLink: () => void;
  linkCopied: boolean;
}) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-10">
      <div className="absolute inset-0 bg-grid pointer-events-none" />

      <div className="relative w-full max-w-md flex flex-col items-stretch gap-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/[0.03] text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
            Room
          </div>
          <h1 className="mt-3 text-[28px] font-semibold tracking-tight font-mono">
            {roomId}
          </h1>
          <button
            onClick={onCopyLink}
            className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border-strong)] bg-[var(--surface)] hover:bg-[var(--bg-elev)] text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            {linkCopied ? (
              <>
                <Check size={12} /> Link copied
              </>
            ) : (
              <>
                <Copy size={12} /> Copy invite link
              </>
            )}
          </button>
        </div>

        <div className="rounded-2xl bg-[var(--bg-elev)] border border-[var(--border)] p-5 flex flex-col gap-4">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] block mb-1.5">
              Your name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 40))}
              placeholder="Your name"
              className="w-full h-12 px-4 rounded-xl bg-[var(--surface)] border border-[var(--border-strong)] text-[15px] focus:outline-none focus:border-white/20 transition-colors"
            />
          </div>
          <LanguageSelect
            value={lang}
            onChange={setLang}
            label="Your language"
          />
        </div>

        <Button size="lg" onClick={onJoin} disabled={!name.trim()}>
          <Video size={18} />
          Join call
        </Button>

        <p className="text-center text-[11px] text-[var(--text-dim)] leading-relaxed">
          Your browser will ask permission for camera & microphone.
          <br />
          Video and chat are sent peer-to-peer.
        </p>
      </div>
    </div>
  );
}
