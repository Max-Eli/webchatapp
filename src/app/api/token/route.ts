import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { isValidRoomId } from "@/lib/roomId";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  room?: string;
  identity?: string;
  name?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const room = (body.room ?? "").toString();
  const identity = (body.identity ?? "").toString();
  const name = (body.name ?? "").toString().slice(0, 40) || "Guest";

  if (!isValidRoomId(room)) {
    return NextResponse.json({ error: "Invalid room id" }, { status: 400 });
  }
  if (!identity || identity.length > 64) {
    return NextResponse.json({ error: "Invalid identity" }, { status: 400 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret || !url) {
    return NextResponse.json(
      {
        error:
          "LiveKit not configured. Set LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and NEXT_PUBLIC_LIVEKIT_URL.",
      },
      { status: 500 }
    );
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name,
    ttl: 60 * 60, // 1 hour
  });
  at.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const token = await at.toJwt();
  return NextResponse.json({ token, url });
}
