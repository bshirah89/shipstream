# ShipStream

Real-time shipboard operations dashboard demonstrating JWT auth, Server-Sent Events, and AI integration with Claude.

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | Next.js 14 App Router | Colocates API routes and React pages; RSC for server-side auth |
| Language | TypeScript (strict) | Discriminated unions model event types; interfaces shared client↔server |
| Styling | Tailwind CSS | Utility-first; zero runtime CSS overhead |
| ORM | Prisma + SQLite/Postgres | Type-safe DB access; swap provider without changing queries |
| Auth | JWT in httpOnly cookie | Cookie blocks XSS token theft; JWT avoids DB round-trips on every request |
| Real-time | Server-Sent Events (SSE) | Unidirectional push — simpler than WebSocket for read-only streams |
| AI | Anthropic Claude API | Streaming responses appear word-by-word; no buffering wait |
| Deployment | Vercel | Zero-config for Next.js; handles SSE streaming natively |

## Architecture

```
Browser                   Next.js Server              SQLite
  │                           │                          │
  │── POST /api/auth/login ──>│                          │
  │                           │── findUnique(email) ────>│
  │<── Set-Cookie: JWT ───────│                          │
  │                                                      │
  │── GET /api/events/stream ─>│ (SSE, stays open)       │
  │                           │── event.create() ───────>│
  │<── data: {event} ─────────│ (every 2s)               │
  │                           │                          │
  │── POST /api/ai/analyze ──>│                          │
  │                           │──> Anthropic API         │
  │<── streamed text ─────────│ (word-by-word)           │
```

### Key decisions

**JWT in httpOnly cookie (not localStorage)**
`localStorage` is readable by any JS on the page — a single XSS vulnerability would expose every user's token. `httpOnly` cookies are invisible to JavaScript; the browser attaches them automatically and the server validates them. Trade-off: requires CSRF protection (handled via `sameSite: "lax"`).

**Edge-compatible JWT verification in middleware**
`middleware.ts` runs on the Vercel Edge Runtime, which doesn't have Node.js APIs. `jsonwebtoken` uses Node's `crypto` module — incompatible. `jose` uses the Web Crypto API and works on the Edge. Both use HS256 with the same secret.

**Prisma singleton pattern**
Next.js hot-reload re-executes module code on every file save in development. Without the `globalThis` guard, each reload would create a new `PrismaClient` instance and eventually exhaust the SQLite connection pool. Production creates exactly one instance per process.

**SSE over WebSocket**
SSE is HTTP/1.1-native — no upgrade handshake, works through most proxies, and browsers reconnect automatically on disconnect. WebSocket would be overkill for a unidirectional event push. The trade-off: SSE is text-only and uni-directional; use WebSocket when you need binary data or bidirectional messaging.

**Streaming Claude responses**
Anthropic's API supports streaming via `messages.stream()`. The route pipes this directly to the HTTP response body with `Transfer-Encoding: chunked`. The client reads chunks via `response.body.getReader()`. This eliminates the perceived latency of waiting for a full response — users see text appear immediately.

**SQLite locally, Postgres in production**
Prisma abstracts the difference — change `provider` in `schema.prisma` and update `DATABASE_URL`. The only code change needed is removing the JSON-string workaround (SQLite doesn't support a native JSON column type; Postgres does).

## Setup

### Prerequisites
- Node.js ≥ 18.17
- An Anthropic API key (optional — app works without it, AI analysis button shows a config error)

### Local development

```bash
# 1. Install dependencies
npm install

# 2. Create your env file
cp .env.example .env.local
# Edit .env.local and set JWT_SECRET and ANTHROPIC_API_KEY

# 3. Create the database
npm run db:push

# 4. Start the dev server
npm run dev
```

Open http://localhost:3000, register an account, and watch events stream in.

### Generate a strong JWT secret

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Production (Vercel)

1. Push to GitHub
2. Import in Vercel — it detects Next.js automatically
3. Set environment variables in the Vercel dashboard:
   - `DATABASE_URL` — your Postgres connection string (Vercel Postgres, Neon, Supabase, etc.)
   - `JWT_SECRET` — the random 64-byte hex string
   - `ANTHROPIC_API_KEY` — your Claude API key
4. Change `provider = "sqlite"` to `provider = "postgresql"` in `prisma/schema.prisma`
5. Deploy

## Project Structure

```
shipstream/
├── app/
│   ├── page.tsx                    # Login/register page (Client Component)
│   ├── dashboard/page.tsx          # Protected dashboard (Server Component → Client)
│   ├── layout.tsx                  # Root layout, global CSS
│   └── api/
│       ├── auth/login/route.ts     # POST — validates creds, sets JWT cookie
│       ├── auth/register/route.ts  # POST — hashes password, creates user, sets cookie
│       ├── auth/logout/route.ts    # POST — clears the cookie
│       ├── events/stream/route.ts  # GET — SSE stream, emits mock events every 2s
│       └── ai/analyze/route.ts     # POST — streams Claude summary
├── components/
│   ├── Dashboard.tsx               # Layout shell, owns shared `currentEvents` state
│   ├── EventFeed.tsx               # SSE consumer, renders scrollable event list
│   └── AIAnalysis.tsx              # Streaming Claude UI with loading states
├── hooks/
│   ├── useEventStream.ts           # EventSource lifecycle management
│   └── useAuth.ts                  # login/register/logout with router integration
├── lib/
│   ├── auth.ts                     # hashPassword, signToken, verifyToken, cookie helpers
│   ├── prisma.ts                   # Singleton PrismaClient
│   └── claude.ts                   # Anthropic SDK wrapper, streaming + non-streaming
├── middleware.ts                   # Edge JWT verification, redirect logic
├── prisma/schema.prisma            # User + Event models
└── types/index.ts                  # Shared TypeScript interfaces
```

## Interview talking points

- **Why not sessions?** JWTs are stateless — the server verifies the signature without a DB lookup, which scales horizontally. Trade-off: you can't invalidate a token before expiry without a denylist (which reintroduces statefulness).
- **How does SSE handle reconnects?** The browser's `EventSource` API automatically reconnects with exponential backoff. The server sends `id:` fields so clients can resume from where they left off using `Last-Event-ID`.
- **How would you scale the SSE endpoint?** Each open SSE connection holds a Node.js stream. Horizontal scaling requires a message broker (Redis pub/sub) to fan out events to all server instances.
- **Why streaming for Claude?** P50 latency for a Claude response is ~2-3s. Streaming makes users perceive it as ~200ms to first token. The UI feels dramatically faster even though total latency is identical.
