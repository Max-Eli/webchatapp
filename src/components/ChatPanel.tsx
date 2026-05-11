"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquare, Send, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Message, type ChatMessage } from "./Message";
import { LanguageSelect } from "./LanguageSelect";

type Props = {
  messages: ChatMessage[];
  myLang: string;
  onLangChange: (code: string) => void;
  onSend: (text: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unread: number;
  onMarkRead: () => void;
  connected: boolean;
};

export const ChatPanel = forwardRef<HTMLDivElement, Props>(function ChatPanel(
  {
    messages,
    myLang,
    onLangChange,
    onSend,
    open,
    onOpenChange,
    unread,
    onMarkRead,
    connected,
  },
  ref
) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => scrollRef.current as HTMLDivElement);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      onMarkRead();
    }
  }, [open, messages, onMarkRead]);

  function submit() {
    const text = draft.trim();
    if (!text || !connected) return;
    onSend(text);
    setDraft("");
    inputRef.current?.focus();
  }

  return (
    <>
      {/* Floating toggle (mobile + desktop closed state) */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={() => onOpenChange(true)}
            className={cn(
              "fixed z-30 right-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] md:bottom-6",
              "h-14 w-14 rounded-full glass flex items-center justify-center",
              "shadow-2xl shadow-black/50 hover:scale-105 transition-transform"
            )}
            aria-label="Open chat"
          >
            <MessageSquare size={22} className="text-[var(--text)]" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-[var(--accent)] text-[#06231a] text-[11px] font-semibold flex items-center justify-center">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <>
            {/* Mobile backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => onOpenChange(false)}
              className="fixed inset-0 z-30 bg-black/40 md:hidden"
            />

            <motion.aside
              initial={{ x: "100%", opacity: 0.5 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className={cn(
                "fixed z-40 right-0 top-0 bottom-0",
                "w-full md:w-[400px]",
                "flex flex-col glass border-l border-white/10",
                "pb-[env(safe-area-inset-bottom)]"
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/8">
                <div className="flex flex-col min-w-0">
                  <span className="text-[15px] font-semibold tracking-tight">
                    Chat
                  </span>
                  <span className="text-[11px] text-[var(--text-dim)]">
                    Auto-translates to your language
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <LanguageSelect
                    value={myLang}
                    onChange={onLangChange}
                    compact
                  />
                  <button
                    onClick={() => onOpenChange(false)}
                    className="h-9 w-9 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white/5 transition-colors"
                    aria-label="Close chat"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
              >
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center px-6 gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center">
                      <MessageSquare
                        size={20}
                        className="text-[var(--text-dim)]"
                      />
                    </div>
                    <div>
                      <div className="text-sm text-[var(--text)] font-medium">
                        No messages yet
                      </div>
                      <div className="text-[12px] text-[var(--text-dim)] mt-0.5 max-w-[220px]">
                        Send a message — it&apos;ll appear translated in your
                        friend&apos;s language.
                      </div>
                    </div>
                  </div>
                )}

                {messages.map((m) => (
                  <Message key={m.id} message={m} myLang={myLang} />
                ))}
              </div>

              {/* Input */}
              <div className="p-3 border-t border-white/8">
                <div className="flex items-end gap-2 rounded-2xl bg-[var(--surface)] border border-[var(--border-strong)] focus-within:border-white/20 transition-colors px-3 py-2">
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
                    placeholder={
                      connected ? "Message…" : "Waiting for connection…"
                    }
                    disabled={!connected}
                    rows={1}
                    className="flex-1 bg-transparent resize-none outline-none text-[15px] placeholder:text-[var(--text-dim)] max-h-32 disabled:opacity-50"
                    style={{ minHeight: "24px" }}
                  />
                  <button
                    onClick={submit}
                    disabled={!draft.trim() || !connected}
                    className={cn(
                      "h-9 w-9 rounded-lg flex items-center justify-center transition-all",
                      draft.trim() && connected
                        ? "bg-[var(--accent)] text-[#06231a] hover:bg-[var(--accent-strong)]"
                        : "bg-white/5 text-[var(--text-dim)]"
                    )}
                    aria-label="Send message"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
});
