"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

type Props = {
  stream: MediaStream | null;
  muted?: boolean;
  mirror?: boolean;
  className?: string;
  fit?: "cover" | "contain";
};

export function VideoTile({
  stream,
  muted = false,
  mirror = false,
  className,
  fit = "cover",
}: Props) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (stream && el.srcObject !== stream) {
      el.srcObject = stream;
    } else if (!stream && el.srcObject) {
      el.srcObject = null;
    }
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={cn(
        "h-full w-full bg-black",
        fit === "cover" ? "object-cover" : "object-contain",
        mirror && "scale-x-[-1]",
        className
      )}
    />
  );
}
