"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Languages, Video } from "lucide-react";
import { Button } from "@/components/Button";
import {
  generateRoomId,
  isValidRoomId,
  normalizeRoomId,
} from "@/lib/roomId";
import { LANGUAGES } from "@/lib/languages";

export default function LandingPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function createRoom() {
    const id = generateRoomId();
    router.push(`/room/${id}`);
  }

  function joinRoom(e: React.FormEvent) {
    e.preventDefault();
    const id = normalizeRoomId(joinCode);
    if (!isValidRoomId(id)) {
      setError("Codes look like aaa-bbbb-ccc (lowercase letters)");
      return;
    }
    setError(null);
    router.push(`/room/${id}`);
  }

  return (
    <div className="relative flex flex-1 flex-col">
      <div className="absolute inset-0 bg-grid pointer-events-none" />

      <header className="relative z-10 flex items-center justify-between px-6 md:px-10 py-6">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-[var(--accent)] flex items-center justify-center">
            <Languages size={16} className="text-[#06231a]" />
          </div>
          <span className="text-[17px] font-semibold tracking-tight">
            Lingo
          </span>
        </div>
        <span className="text-xs text-[var(--text-dim)] hidden sm:block">
          {LANGUAGES.length} languages · End-to-end peer chat
        </span>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-[480px] flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/[0.03] text-[11px] text-[var(--text-muted)] uppercase tracking-wider mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] pulse-dot" />
            No accounts · No installs
          </div>

          <h1 className="text-[40px] md:text-[56px] leading-[1.05] font-semibold tracking-tight">
            Talk to anyone,
            <br />
            <span className="text-[var(--accent)]">in any language.</span>
          </h1>

          <p className="mt-5 text-[15px] md:text-base text-[var(--text-muted)] max-w-[400px] leading-relaxed">
            Start a 1-on-1 video call. Type in your language, your friend reads
            it in theirs. Translated live by Claude.
          </p>

          <div className="mt-10 w-full flex flex-col gap-3">
            <Button size="lg" className="w-full" onClick={createRoom}>
              <Video size={18} />
              Start a new call
              <ArrowRight size={18} />
            </Button>

            <div className="my-2 flex items-center gap-3 text-[11px] uppercase tracking-wider text-[var(--text-dim)]">
              <div className="flex-1 h-px bg-[var(--border)]" />
              or join one
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>

            <form onSubmit={joinRoom} className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  value={joinCode}
                  onChange={(e) => {
                    setJoinCode(e.target.value);
                    setError(null);
                  }}
                  placeholder="aaa-bbbb-ccc"
                  inputMode="text"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="flex-1 h-14 px-4 rounded-2xl bg-[var(--surface)] border border-[var(--border-strong)] text-[15px] font-mono tracking-wider placeholder:text-[var(--text-dim)] placeholder:font-sans placeholder:tracking-normal focus:outline-none focus:border-white/20 transition-colors"
                />
                <Button
                  type="submit"
                  size="lg"
                  variant="secondary"
                  className="px-5"
                  disabled={!joinCode.trim()}
                >
                  <ArrowRight size={18} />
                </Button>
              </div>
              {error && (
                <p className="text-[12px] text-[var(--danger)] text-left px-1">
                  {error}
                </p>
              )}
            </form>
          </div>
        </div>
      </main>

      <footer className="relative z-10 px-6 md:px-10 py-6 text-center text-[11px] text-[var(--text-dim)]">
        Peer-to-peer video · Translation by Claude
      </footer>
    </div>
  );
}
