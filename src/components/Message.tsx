"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Languages } from "lucide-react";
import { cn } from "@/lib/cn";
import { getLanguage } from "@/lib/languages";

export type ChatMessage = {
  id: string;
  text: string;
  sourceLang: string;
  name: string;
  ts: number;
  mine: boolean;
  translated?: string;
  translating?: boolean;
  translationError?: boolean;
};

type Props = {
  message: ChatMessage;
  myLang: string;
};

export function Message({ message, myLang }: Props) {
  const [showOriginal, setShowOriginal] = useState(false);
  const sameLang = message.sourceLang === myLang;
  const sourceLangInfo = getLanguage(message.sourceLang);
  const primary = sameLang ? message.text : message.translated ?? "";
  const showSpinner = !sameLang && message.translating && !message.translated;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn(
        "flex flex-col",
        message.mine ? "items-end" : "items-start"
      )}
    >
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] px-1 mb-1">
        {message.name}
      </div>

      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug",
          message.mine
            ? "bg-[var(--accent)] text-[#06231a] rounded-br-sm"
            : "bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-bl-sm"
        )}
      >
        {showSpinner ? (
          <span className="inline-flex items-center gap-2 text-[var(--text-muted)]">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
              <span
                className="h-1.5 w-1.5 rounded-full bg-current animate-pulse"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="h-1.5 w-1.5 rounded-full bg-current animate-pulse"
                style={{ animationDelay: "300ms" }}
              />
            </span>
            <span className="text-xs">Translating</span>
          </span>
        ) : (
          <>
            <div className="whitespace-pre-wrap break-words">
              {primary || message.text}
            </div>
            {message.translationError && !sameLang && (
              <div
                className={cn(
                  "mt-1 text-[11px]",
                  message.mine ? "text-[#06231a]/70" : "text-[var(--danger)]"
                )}
              >
                Translation failed — showing original
              </div>
            )}
          </>
        )}
      </div>

      {!sameLang && message.translated && !message.mine && (
        <button
          type="button"
          onClick={() => setShowOriginal((v) => !v)}
          className="mt-1 px-1 text-[11px] text-[var(--text-dim)] hover:text-[var(--text-muted)] inline-flex items-center gap-1 transition-colors"
        >
          <Languages size={10} />
          {showOriginal ? "Hide" : "Show"} original
          {sourceLangInfo && ` (${sourceLangInfo.code.toUpperCase()})`}
        </button>
      )}

      {!sameLang && showOriginal && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="max-w-[85%] mt-1 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5 text-[13px] text-[var(--text-muted)] italic"
        >
          {message.text}
        </motion.div>
      )}
    </motion.div>
  );
}
