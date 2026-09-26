# UNIVOX

UNIVOX is a creator operating system. This repository is a modular Next.js monolith covering identity, community, content, monetization, live events, and AI. Payments, live media, and AI remain fail-closed unless a real integration is configured.

## Stack

- Next.js 15 App Router, TypeScript, Prisma, PostgreSQL
- Vitest, ESLint, GitHub Actions
- Auth: HttpOnly cookies plus bearer JWT (`univox_access` 15m, `univox_refresh` 7d)
- Passwords: scrypt (`scrypt$N$r$p$salt$hash`)
- Media: memory storage in development/test, S3-compatible storage in production
- Payments: provider abstraction with a signed sandbox adapter for local/test use
- Live: provider abstraction (`local` in development/test; Daily or LiveKit when credentials exist)
- AI: provider abstraction (OpenAI, Gemini, Anthropic) with timeouts, retries, and usage tracking

## Modules

| Module | Status | Notes |
| --- | --- | --- |
| Identity | Implemented | Register, login, refresh, revoke, profiles, organizations |
| Community | Implemented | Tenant-scoped communities, channels, posts, moderation |
| Content | Implemented | Draft/publish media, feed, follows, engagement |
| Monetization | Implemented | Membership products, verified payments, creator earnings |
| Live | Implemented | Schedule, access control, local/live-provider rooms, chat, recording metadata |
| AI | Implemented | Captions, repurpose, event summary, analytics explain; fail-closed without credentials |
| Analytics | Stubbed | `501 NOT_IMPLEMENTED` |

## Monetization

Creators can sell a paid membership. A payer starts a transaction; status never comes from the client. Only a verified provider webhook can move money records through:

`PENDING -> PROCESSING -> SUCCEEDED | FAILED | CANCELLED`, then `SUCCEEDED -> REFUNDED`.

Each transaction stores payer, recipient, product, amount, currency, provider, provider reference, platform fee, creator amount, status, and timestamps. Duplicate webhooks are ignored. Invalid signatures are rejected. Amount and currency in the webhook must match the stored transaction.

The payment provider interface is provider-agnostic (`sandbox`, `stripe`, `paystack`, `flutterwave`). This environment implements **sandbox only**. Live processors are not simulated. Production rejects `PAYMENTS_PROVIDER=sandbox`. Checkout against an unimplemented live provider returns `503 SERVICE_UNAVAILABLE`.

Payouts to bank accounts are not implemented.

### Payment API

- `POST /api/v1/products` — create a membership product
- `GET /api/v1/products` — list the authenticated creator's products
- `GET /api/v1/products/{productId}` — fetch a product
- `PATCH /api/v1/products/{productId}` — owner update
- `POST /api/v1/payments` — initiate checkout (`Idempotency-Key` supported)
- `GET /api/v1/payments` — payer transaction history
- `GET /api/v1/payments/{transactionId}` — payer or recipient only
- `POST /api/v1/payments/webhooks` — signed provider webhook
- `GET /api/v1/creators/me/earnings` — gross, platform fee, net, history

Sandbox webhooks must be HMAC-SHA256 signed with `PAYMENTS_WEBHOOK_SECRET` in `x-univox-sandbox-signature`.

## Live events

Creators can draft, edit, publish, start, end, and cancel events. Access types are `FREE`, `SUBSCRIBER`, and `PAID`. Subscriber access requires an active creator membership. Paid access requires a verified succeeded payment to the host. Client-declared payment success is rejected.

Event lifecycle:

`DRAFT -> SCHEDULED -> LIVE -> ENDED`, with `DRAFT | SCHEDULED -> CANCELLED`.

The live-room interface supports `local`, `daily`, and `livekit`. This environment implements **local rooms only**. Local rooms issue join metadata for tests and development. They do not produce recordings. Production rejects `LIVE_PROVIDER=local`. Daily and LiveKit return `503 SERVICE_UNAVAILABLE` until `LIVE_API_KEY` (and provider implementation) are present.

Recording: requesting a recording from a local room stores `UNAVAILABLE` metadata. Hosts may upload recording bytes to the storage provider after the event ends. Downloads require host or registered attendee authorization. Missing storage or provider support is not reported as success.

Transcripts: hosts may store a real transcript after the event ends. AI summary requires a configured language model and returns `503` until one is present. Transcripts and summaries are never fabricated.

### Event API

- `POST /api/v1/events` — create a draft
- `GET /api/v1/events` — list the host's events
- `GET /api/v1/events/{eventId}` — fetch a visible event
- `PATCH /api/v1/events/{eventId}` — host edit
- `POST /api/v1/events/{eventId}/publish`
- `POST /api/v1/events/{eventId}/cancel`
- `POST /api/v1/events/{eventId}/start` — open the live room
- `POST /api/v1/events/{eventId}/end`
- `POST /api/v1/events/{eventId}/register` — `{ transactionId }` required for paid events
- `GET /api/v1/events/{eventId}/attendees` — host only
- `POST /api/v1/events/{eventId}/attendance` — check in and receive a join token
- `DELETE /api/v1/events/{eventId}/attendance` — leave
- `GET|POST /api/v1/events/{eventId}/chat`
- `GET|POST /api/v1/events/{eventId}/recordings`
- `GET /api/v1/events/{eventId}/recordings/{recordingId}`
- `GET|POST /api/v1/events/{eventId}/transcripts`
- `POST /api/v1/events/{eventId}/transcripts/{transcriptId}/summary`

### External infrastructure

To run live media and recordings in production you need:

- A media provider such as Daily or LiveKit, with `LIVE_PROVIDER` and `LIVE_API_KEY`
- Object storage (`STORAGE_PROVIDER=s3` plus bucket credentials) for uploaded recordings
- A configured language model before transcript summaries can succeed
- A live payment provider before paid-event settlement can leave sandbox

Local development uses `LIVE_PROVIDER=local` and does not require Daily, LiveKit, or an LLM.

## AI

Creators can generate captions, repurpose content, summarize an owned event transcript, and explain their own analytics snapshot. The gateway is:

User request → authz → context assembly → model router → provider → output validation → usage tracking.

AI cannot transfer money, modify financial records, bypass authorization, change ownership, or delete records. Prompt, completion, and transcript text are redacted from logs. Missing credentials, timeouts, and invalid provider output fail closed (`503` / `400`); they are not reported as success.

The provider interface supports `openai`, `gemini`, and `anthropic`. Tests may inject a deterministic mock via `setAiProvider`. Production and development do not invent completions.

### AI API

- `POST /api/v1/ai/captions` — `{ contentId }` or `{ text, tone? }`
- `POST /api/v1/ai/repurpose` — `{ contentId }` or `{ text, format? }` (`thread` | `newsletter` | `short`)
- `POST /api/v1/ai/analytics/explain` — `{ question? }` using the caller's content, events, and succeeded payments
- `POST /api/v1/events/{eventId}/transcripts/{transcriptId}/summary` — host only
- `GET /api/v1/ai` — list the caller's jobs
- `GET /api/v1/ai/usage` — aggregated token usage

### External AI infrastructure

To run generation outside tests you need `AI_PROVIDER` plus the matching key (`OPENAI_API_KEY`, `GEMINI_API_KEY`, or `ANTHROPIC_API_KEY`). Optional: `AI_MODEL`, `AI_TIMEOUT_MS`, `AI_MAX_RETRIES`, `OPENAI_BASE_URL`.

## Configuration

Copy `.env.example` and set real values. Never commit secrets.

Required:

- `APP_URL`
- `DATABASE_URL`
- `AUTH_SECRET` (32+ characters; production rejects placeholders)
- `CORS_ORIGINS`

Storage:

- `STORAGE_PROVIDER=memory` for development/test
- `STORAGE_PROVIDER=s3` plus `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` in production

Payments:

- `PAYMENTS_PROVIDER=sandbox` for development/test
- `PAYMENTS_WEBHOOK_SECRET` required for sandbox
- `PAYMENTS_PLATFORM_FEE_BPS` (default `1000` = 10%)
- Live payment processors require their own credentials and are not implemented in this release

Live rooms:

- `LIVE_PROVIDER=local` for development/test
- Production requires `daily` or `livekit` plus `LIVE_API_KEY`
- `LIVE_API_URL` optional provider endpoint

AI:

- Leave `AI_PROVIDER` unset to keep generation unavailable
- Set `AI_PROVIDER` to `openai`, `gemini`, or `anthropic` plus the matching API key
- `AI_TIMEOUT_MS` (default `15000`), `AI_MAX_RETRIES` (default `1`)

## Development

```bash
npm install
npx prisma generate
npm run dev
```

Apply migrations against a live PostgreSQL database when one is available:

```bash
npx prisma migrate deploy
```

## Verification

```bash
npx prisma generate
npm test
npm run typecheck
npm run lint
npm run build
```

Identity, community, content, payments, events, and AI tests use in-memory stores. They do not require a running PostgreSQL instance. Migrations still need a live database before production use.

## Security

- Never trust client-supplied org, tenant, or payment-success flags
- Refresh-token reuse revokes the session
- Production rejects placeholder `AUTH_SECRET`, local `DATABASE_URL` defaults, memory storage, sandbox payments, and local live rooms
- AI has no financial authority and does not log prompts, completions, or transcripts
- Media blobs are not stored in PostgreSQL
- Webhook signatures are compared with a constant-time check
