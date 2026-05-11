"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Eye, EyeOff, Languages, Send } from "lucide-react";
import { cn } from "@/lib/cn";
import { getLanguage } from "@/lib/languages";
import type { ChatMessage } from "@/lib/chat";

type Props = {
  messages: ChatMessage[];
  myLang: string;
  onSend: (text: string) => void;
  connected: boolean;
};

const MAX_BODY_HEIGHT = 280;

export function ChatOverlay({ messages, myLang, onSend, connected }: Props) {
  const [draft, setDraft] = useState("");
  const [hidden, setHidden] = useState(false);
  const [autoStick, setAutoStick] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages, unless user scrolled up
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
    <div className="pointer-events-none fixed z-30 left-0 right-0 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] md:bottom-6 px-3 md:left-6 md:right-auto md:px-0">
      <div
        className={cn(
          "pointer-events-auto w-full md:w-[420px] flex flex-col",
          "rounded-3xl overflow-hidden",
          "border border-white/8",
          "bg-gradient-to-b from-black/40 via-black/30 to-black/40 backdrop-blur-xl",
          "shadow-2xl shadow-black/40"
        )}
      >
        {/* Tiny header strip with language + collapse */}
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-white/5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/50">
            <Languages size={11} />
            Live chat ·
            <span className="text-white/70">
              {getLanguage(myLang)?.native ?? myLang.toUpperCase()}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setHidden((v) => !v)}
            className="h-6 w-6 rounded-md flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
            aria-label={hidden ? "Show messages" : "Hide messages"}
          >
            {hidden ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
        </div>

        {/* Message stream */}
        <AnimatePresence initial={false}>
          {!hidden && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
              className="relative"
            >
              <div
                ref={scrollRef}
                onScroll={onScroll}
                className="overflow-y-auto px-3 py-2.5 space-y-1.5"
                style={{ maxHeight: MAX_BODY_HEIGHT }}
              >
                {messages.length === 0 && (
                  <div className="py-6 text-center">
                    <div className="text-[12px] text-white/55">
                      Send a message — it&apos;ll appear translated for your
                      friend.
                    </div>
                  </div>
                )}
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
                  className="absolute right-3 -top-9 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--accent)] text-[#06231a] text-[11px] font-medium shadow-lg"
                >
                  <ChevronDown size={12} />
                  Latest
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Compose */}
        <div className="px-2 py-2 border-t border-white/5">
          <div
            className={cn(
              "flex items-end gap-1.5 rounded-2xl bg-white/5 border border-white/10 px-3 py-1.5 transition-colors",
              "focus-within:border-white/25 focus-within:bg-white/[0.07]"
            )}
          >
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
              className="flex-1 bg-transparent resize-none outline-none text-[14px] text-white placeholder:text-white/40 max-h-24 disabled:opacity-50 py-1.5"
              style={{ minHeight: "24px" }}
            />
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim() || !connected}
              className={cn(
                "h-8 w-8 shrink-0 rounded-lg flex items-center justify-center transition-all",
                draft.trim() && connected
                  ? "bg-[var(--accent)] text-[#06231a] hover:bg-[var(--accent-strong)] active:scale-95"
                  : "bg-white/5 text-white/30"
              )}
              aria-label="Send message"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
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
      className="flex flex-col"
    >
      <div className="flex items-baseline gap-1.5 leading-tight">
        <span
          className={cn(
            "text-[12px] font-semibold shrink-0",
            message.mine ? "text-[var(--accent)]" : "text-white"
          )}
        >
          {message.mine ? "You" : message.name}
        </span>
        {showSpinner ? (
          <span className="inline-flex items-center gap-1.5 text-white/60 text-[13px]">
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
            <span className="text-[11px] italic">translating</span>
          </span>
        ) : (
          <span className="text-white text-[13.5px] leading-snug whitespace-pre-wrap break-words">
            {primary || message.text}
            {message.translationError && !sameLang && (
              <span className="ml-1.5 text-[11px] text-[var(--danger)] italic">
                (translation failed)
              </span>
            )}
          </span>
        )}
      </div>

      {!sameLang && message.translated && !message.mine && (
        <div className="ml-[2.5rem] mt-0.5">
          <button
            type="button"
            onClick={() => setShowOriginal((v) => !v)}
            className="inline-flex items-center gap-1 text-[10px] text-white/40 hover:text-white/65 transition-colors"
          >
            <Languages size={9} />
            {showOriginal ? "Hide" : "Show"} original
            {sourceLangInfo && ` · ${sourceLangInfo.code.toUpperCase()}`}
          </button>
          {showOriginal && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-1 px-2 py-1 rounded-md bg-white/[0.04] border border-white/5 text-[12px] text-white/70 italic"
            >
              {message.text}
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
  );
}
