"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Languages, Send } from "lucide-react";
import { cn } from "@/lib/cn";
import { getLanguage } from "@/lib/languages";
import type { ChatMessage } from "@/lib/chat";

type Props = {
  messages: ChatMessage[];
  myLang: string;
  onSend: (text: string) => void;
  connected: boolean;
};

const MAX_BODY_HEIGHT = 320;

// Heavy text-shadow makes white text legible over any video background
// without needing a panel backdrop.
const TEXT_SHADOW =
  "0 1px 2px rgba(0,0,0,0.85), 0 0 6px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.45)";

export function ChatOverlay({ messages, myLang, onSend, connected }: Props) {
  const [draft, setDraft] = useState("");
  const [autoStick, setAutoStick] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!autoStick) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, autoStick]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    setAutoStick(atBottom);
  }

  function submit() {
    const text = draft.trim();
    if (!text || !connected) return;
    onSend(text);
    setDraft("");
    setAutoStick(true);
    inputRef.current?.focus();
  }

  return (
    <div
      className={cn(
        "pointer-events-none fixed z-30",
        "left-0 right-0 bottom-[calc(env(safe-area-inset-bottom)+5rem)] md:bottom-6",
        "px-3 md:left-6 md:right-auto md:px-0",
        "flex flex-col items-stretch md:max-w-[400px]"
      )}
    >
      {/* Messages — no container chrome, just text over video */}
      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="pointer-events-auto overflow-y-auto space-y-1 pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ maxHeight: MAX_BODY_HEIGHT }}
        >
          {messages.map((m) => (
            <StreamMessage key={m.id} message={m} myLang={myLang} />
          ))}
        </div>

        {!autoStick && messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setAutoStick(true);
              const el = scrollRef.current;
              if (el) el.scrollTop = el.scrollHeight;
            }}
            className="pointer-events-auto absolute right-1 -top-7 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent)] text-[#06231a] text-[10px] font-medium shadow-lg"
          >
            <ChevronDown size={11} />
            Latest
          </button>
        )}
      </div>

      {/* Compose pill */}
      <div className="pointer-events-auto mt-2 flex items-center gap-1.5 rounded-full bg-black/45 backdrop-blur-md border border-white/10 pl-4 pr-1 py-1 shadow-lg shadow-black/30 focus-within:border-white/25 focus-within:bg-black/60 transition-colors">
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={connected ? "Message…" : "Connecting…"}
          disabled={!connected}
          rows={1}
          className="flex-1 bg-transparent resize-none outline-none text-[14px] text-white placeholder:text-white/45 max-h-24 disabled:opacity-50 py-1.5"
          style={{ minHeight: "20px" }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!draft.trim() || !connected}
          className={cn(
            "h-8 w-8 shrink-0 rounded-full flex items-center justify-center transition-all",
            draft.trim() && connected
              ? "bg-[var(--accent)] text-[#06231a] hover:bg-[var(--accent-strong)] active:scale-95"
              : "bg-white/8 text-white/30"
          )}
          aria-label="Send message"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

function StreamMessage({
  message,
  myLang,
}: {
  message: ChatMessage;
  myLang: string;
}) {
  const [showOriginal, setShowOriginal] = useState(false);
  const sameLang = message.sourceLang === myLang;
  const showSpinner = !sameLang && message.translating && !message.translated;
  const primary = sameLang ? message.text : message.translated ?? "";
  const sourceLangInfo = getLanguage(message.sourceLang);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
      className="leading-snug"
      style={{ textShadow: TEXT_SHADOW }}
    >
      <span
        className={cn(
          "text-[13px] font-semibold mr-1.5",
          message.mine ? "text-[var(--accent)]" : "text-white"
        )}
      >
        {message.mine ? "You" : message.name}
      </span>
      {showSpinner ? (
        <span className="inline-flex items-center gap-1 text-white/70 text-[13px] align-middle">
          <span className="flex gap-0.5">
            <span className="h-1 w-1 rounded-full bg-current animate-pulse" />
            <span
              className="h-1 w-1 rounded-full bg-current animate-pulse"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="h-1 w-1 rounded-full bg-current animate-pulse"
              style={{ animationDelay: "300ms" }}
            />
          </span>
        </span>
      ) : (
        <span className="text-white text-[14px] whitespace-pre-wrap break-words">
          {primary || message.text}
          {message.translationError && !sameLang && (
            <span className="ml-1 text-[11px] text-[var(--danger)] italic">
              (translation failed)
            </span>
          )}
        </span>
      )}

      {!sameLang && message.translated && !message.mine && (
        <>
          <button
            type="button"
            onClick={() => setShowOriginal((v) => !v)}
            className="ml-2 inline-flex items-center gap-0.5 text-[10px] text-white/55 hover:text-white/85 align-middle transition-colors"
            style={{ textShadow: TEXT_SHADOW }}
          >
            <Languages size={9} />
            {showOriginal ? "hide" : sourceLangInfo?.code.toUpperCase() ?? "src"}
          </button>
          <AnimatePresence>
            {showOriginal && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="text-[12px] text-white/70 italic mt-0.5"
                style={{ textShadow: TEXT_SHADOW }}
              >
                {message.text}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  );
}
