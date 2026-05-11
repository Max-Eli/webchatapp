# Lingo — video chat across languages

A 1-on-1 mobile webapp for video calling friends who don't speak your language. Type in your language, your friend reads it in theirs. Translation by Claude.

- **Peer-to-peer video** (WebRTC) — no media server, no per-minute cost.
- **Peer-to-peer chat** (WebRTC DataChannel) — messages flow direct between browsers.
- **Live translation** via Claude API — your messages get translated for the receiver, theirs get translated for you.
- **No accounts** — just shareable room links like `mki-pwfn-xrt`.
- **Mobile-first** — works in iOS Safari and Android Chrome.

## Setup (one-time, ~5 minutes)

### 1. Get an Anthropic API key

1. Go to https://console.anthropic.com → create an account.
2. Settings → API Keys → Create Key.
3. Copy the key (`sk-ant-...`).

### 2. Get Supabase keys (used for WebRTC signaling only — no database needed)

WebRTC needs a tiny "handshake" channel to connect two browsers. Vercel can't host WebSockets, so we use Supabase Realtime for free.

1. Go to https://supabase.com → sign in (GitHub login works).
2. **New project** → pick any name + region → set a DB password (you won't use it).
3. Wait ~2 minutes for it to provision.
4. **Project Settings → API**, copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

No tables to create. Realtime is on by default.

### 3. Local environment

```bash
cp .env.example .env.local
```

Fill in the three values in `.env.local`.

### 4. Run

```bash
npm install
npm run dev
```

Open http://localhost:3000. Open the generated room link in a second browser (or your phone on the same network — but for getUserMedia on a phone, you'll need HTTPS, which dev mode doesn't have. Easiest: deploy to Vercel and test there).

## Deploy to Vercel

1. Push this repo to GitHub.
2. https://vercel.com/new → import the repo.
3. Add env vars in **Project Settings → Environment Variables**:
   - `ANTHROPIC_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy.

That's it. Free tier covers everything: Vercel (hobby), Supabase (free), and you only pay for Claude tokens (translation is via Haiku — cents per thousand messages).

## How it works

```
Browser A  ───presence + offer/answer/ICE───▶  Supabase Realtime  ◀───presence + offer/answer/ICE───  Browser B
   │                                                                                                       │
   └────────────────── WebRTC peer connection (video + audio + chat data) ─────────────────────────────────┘
                                                  │
                                                  ▼
                                        /api/translate (Claude Haiku)
                                        called by the receiving peer
                                        to render foreign-language messages
```

- Each room is a Supabase Realtime channel `room:<id>`. Both peers track presence and exchange the SDP offer/answer + ICE candidates over `broadcast` events. Once connected, no more signaling traffic.
- Video/audio tracks and chat messages flow over the direct WebRTC connection — Supabase never sees them.
- Chat messages carry a language tag. The receiver's client calls `/api/translate` to render foreign-language messages in the reader's language. Originals are toggleable.
- Translation responses are cached client-side per `(source, target, text)` so changing your language redoes only what's missing.

## Limitations / next steps

- **NAT traversal**: uses public Google STUN. Most consumer networks work, but very strict NATs (corporate / symmetric) need a TURN server. Cheapest path: self-host coturn on a $5 VPS, or pay-as-you-go Twilio TURN (~$0.40/GB).
- **2 peers per room.** Group calls would need an SFU (LiveKit / mediasoup).
- **No persistence.** Messages disappear when you reload. Add a Supabase Postgres table if you want history.
- **No identity verification.** Anyone with the link joins. Fine for a personal app; add auth if you ever need it.
