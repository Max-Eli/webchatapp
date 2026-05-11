# Lingo — video chat across languages

A 1-on-1 mobile webapp for video calling friends who don't speak your language. Type in your language, your friend reads it in theirs. Translation by Claude.

- **Video + audio** via [LiveKit Cloud](https://livekit.io/cloud) — handles signaling, TURN, ICE so calls work on any network.
- **Live translation** via Claude API — your messages get translated for the receiver, theirs get translated for you.
- **Stream-style chat overlay** — always visible on top of the video, no tabs.
- **No accounts** — just shareable room links like `mki-pwfn-xrt`.
- **Mobile-first** — works in iOS Safari and Android Chrome.

## Setup (one-time, ~5 minutes)

### 1. Get an Anthropic API key

1. Go to https://console.anthropic.com → create an account.
2. Settings → API Keys → Create Key.
3. Copy the key (`sk-ant-...`).

### 2. Set up LiveKit Cloud (free tier)

LiveKit handles the entire video calling infrastructure — you don't think about WebRTC, TURN, or NATs.

1. Go to https://livekit.io/cloud → sign up (Google login works).
2. Create a project — pick any name + region close to you.
3. Open the project → **Settings** → **Keys**.
4. Copy:
   - **WebSocket URL** (e.g. `wss://your-project.livekit.cloud`) → `NEXT_PUBLIC_LIVEKIT_URL`
   - **API Key** (starts with `API`) → `LIVEKIT_API_KEY`
   - **API Secret** → `LIVEKIT_API_SECRET`

Free tier: 100 monthly active users + 50 GB bandwidth. Plenty for personal use.

### 3. Local environment

```bash
cp .env.example .env.local
```

Fill in the four values in `.env.local`.

### 4. Run

```bash
npm install
npm run dev
```

Open http://localhost:3000. To test on your phone, deploy to Vercel (next section) — getUserMedia requires HTTPS, which dev mode doesn't provide.

## Deploy to Vercel

1. Push this repo to GitHub.
2. https://vercel.com/new → import the repo.
3. Add env vars in **Project Settings → Environment Variables**:
   - `ANTHROPIC_API_KEY`
   - `LIVEKIT_API_KEY`
   - `LIVEKIT_API_SECRET`
   - `NEXT_PUBLIC_LIVEKIT_URL`
4. Deploy. After it's live, send the URL to your friend.

Total monthly cost for normal personal use: $0.

## How it works

```
Browser A  ─┐                                     ┌─ Browser B
            │   /api/token (mints JWT)            │
            ├──────────────────────────────────── ┤
            │                                     │
            └──── LiveKit Cloud (SFU + TURN) ─────┘
                  · video tracks
                  · audio tracks
                  · data packets (chat)
                              │
                              ▼
                  /api/translate (Claude Haiku)
                  called by the receiving peer
                  to render foreign-language messages
```

- Each room is a LiveKit room named after the room code (`aaa-bbbb-ccc`).
- The Next.js server mints a short-lived access token; the browser uses it to join the LiveKit room.
- Camera, microphone, and chat data flow through LiveKit's media servers (works regardless of NAT).
- Chat messages carry a language tag. The receiver's client calls `/api/translate` to render foreign-language messages in the reader's language. Originals are toggleable.
- Translation responses are cached client-side per `(source, target, text)`.

## Limitations / next steps

- **2 peers per room** (we enforce this on the client). Group calls would just need to lift that cap.
- **No persistence.** Messages disappear when you reload. Add a database if you want history.
- **No identity verification.** Anyone with the link joins. Fine for a personal app.
