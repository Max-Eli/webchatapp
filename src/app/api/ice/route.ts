import { NextResponse } from "next/server";
import { ICE_SERVERS } from "@/lib/webrtc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns ICE servers for WebRTC. If METERED_API_KEY + METERED_APP_NAME are
// set, mints fresh credentials from Metered.ca (50GB/mo free tier, reliable
// TURN). Otherwise falls back to public STUN + best-effort public TURN.
export async function GET() {
  const apiKey = process.env.METERED_API_KEY;
  const app = process.env.METERED_APP_NAME;

  if (!apiKey || !app) {
    return NextResponse.json({ iceServers: ICE_SERVERS, source: "fallback" });
  }

  try {
    const r = await fetch(
      `https://${app}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`,
      { cache: "no-store" }
    );
    if (!r.ok) throw new Error(`metered ${r.status}`);
    const iceServers = (await r.json()) as RTCIceServer[];
    if (!Array.isArray(iceServers) || iceServers.length === 0) {
      throw new Error("metered returned empty list");
    }
    return NextResponse.json({ iceServers, source: "metered" });
  } catch {
    return NextResponse.json({ iceServers: ICE_SERVERS, source: "fallback" });
  }
}
