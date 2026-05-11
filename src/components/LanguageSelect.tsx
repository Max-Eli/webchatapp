"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Languages } from "lucide-react";
import { cn } from "@/lib/cn";
import { LANGUAGES, getLanguage } from "@/lib/languages";

type Props = {
  value: string;
  onChange: (code: string) => void;
  label?: string;
  compact?: boolean;
};

export function LanguageSelect({
  value,
  onChange,
  label = "Your language",
  compact = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const current = getLanguage(value);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = LANGUAGES.filter((l) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      l.name.toLowerCase().includes(q) ||
      l.native.toLowerCase().includes(q) ||
      l.code.toLowerCase().includes(q)
    );
  });

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "group flex items-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] text-left transition-colors hover:border-white/20",
          compact ? "h-9 px-3 text-sm" : "h-12 px-4 w-full"
        )}
      >
        <Languages
          size={compact ? 14 : 16}
          className="text-[var(--text-dim)] shrink-0"
        />
        <div className="flex-1 min-w-0">
          {!compact && (
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
              {label}
            </div>
          )}
          <div className="truncate text-[var(--text)]">
            {current ? current.native : "Select language"}
          </div>
        </div>
        <ChevronDown
          size={compact ? 14 : 16}
          className={cn(
            "shrink-0 text-[var(--text-dim)] transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-50 mt-2 w-[280px] overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-elev)] shadow-2xl shadow-black/40",
            compact ? "right-0" : "left-0"
          )}
        >
          <div className="p-2 border-b border-[var(--border)]">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search languages…"
              className="w-full h-9 px-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-sm placeholder:text-[var(--text-dim)] focus:outline-none focus:border-white/20"
            />
          </div>
          <div className="max-h-[280px] overflow-y-auto py-1">
            {filtered.length === 0 && (
              <div className="px-4 py-3 text-sm text-[var(--text-dim)]">
                No matches
              </div>
            )}
            {filtered.map((l) => {
              const active = l.code === value;
              return (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => {
                    onChange(l.code);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors hover:bg-white/5",
                    active && "text-[var(--accent)]"
                  )}
                >
                  <span className="flex flex-col">
                    <span>{l.native}</span>
                    <span className="text-[11px] text-[var(--text-dim)]">
                      {l.name}
                    </span>
                  </span>
                  {active && <Check size={14} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
