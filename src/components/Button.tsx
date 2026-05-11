"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-[#06231a] hover:bg-[var(--accent-strong)] shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_8px_30px_-12px_var(--accent-glow)]",
  secondary:
    "bg-[var(--surface)] text-[var(--text)] border border-[var(--border-strong)] hover:border-white/20 hover:bg-[var(--bg-elev)]",
  ghost:
    "bg-transparent text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white/5",
  danger:
    "bg-[var(--danger)] text-white hover:bg-[#ff5e5e] shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_8px_30px_-12px_rgba(249,119,119,0.5)]",
};

const SIZE: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-lg gap-1.5",
  md: "h-11 px-4 text-[15px] rounded-xl gap-2",
  lg: "h-14 px-6 text-base rounded-2xl gap-2.5",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = "primary", size = "md", children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      {...rest}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]",
        "disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]",
        VARIANT[variant],
        SIZE[size],
        className
      )}
    >
      {children}
    </button>
  );
});
