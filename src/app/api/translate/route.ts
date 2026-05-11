import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getLanguage } from "@/lib/languages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  text?: string;
  source?: string;
  target?: string;
};

const MAX_LEN = 2000;

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = (body.text ?? "").toString().trim();
  const source = (body.source ?? "").toString().trim();
  const target = (body.target ?? "").toString().trim();

  if (!text) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }
  if (text.length > MAX_LEN) {
    return NextResponse.json(
      { error: `Text too long (max ${MAX_LEN} chars)` },
      { status: 400 }
    );
  }
  if (!source || !target) {
    return NextResponse.json(
      { error: "Missing source or target language" },
      { status: 400 }
    );
  }
  if (source === target) {
    return NextResponse.json({ translated: text });
  }

  const sourceLang = getLanguage(source);
  const targetLang = getLanguage(target);
  if (!sourceLang || !targetLang) {
    return NextResponse.json(
      { error: "Unknown language code" },
      { status: 400 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  const client = new Anthropic({ apiKey });

  const system = [
    `You translate short chat messages between people in real time.`,
    `Translate the user's message from ${sourceLang.name} to ${targetLang.name}.`,
    `Preserve tone, slang, emojis, punctuation, and line breaks.`,
    `Do not translate code blocks, URLs, @mentions, or #hashtags.`,
    `Output ONLY the translated text. No quotes, no explanations, no notes, no preamble.`,
  ].join(" ");

  try {
    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: system,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: text }],
    });

    const out = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    if (!out) {
      return NextResponse.json(
        { error: "Empty translation" },
        { status: 502 }
      );
    }

    return NextResponse.json({ translated: out });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Translation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
