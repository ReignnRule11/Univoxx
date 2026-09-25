# UNIVOX

UNIVOX is a creator operating system. This repository is a modular Next.js monolith covering identity, community, content, and monetization. Payments, events, and AI remain fail-closed unless a real integration is configured.

## Stack

- Next.js 15 App Router, TypeScript, Prisma, PostgreSQL
- Vitest, ESLint, GitHub Actions
- Auth: HttpOnly cookies plus bearer JWT (`univox_access` 15m, `univox_refresh` 7d)
- Passwords: scrypt (`scrypt$N$r$p$salt$hash`)
- Media: memory storage in development/test, S3-compatible storage in production
- Payments: provider abstraction with a signed sandbox adapter for local/test use

## Modules

| Module | Status | Notes |
| --- | --- | --- |
| Identity | Implemented | Register, login, refresh, revoke, profiles, organizations |
| Community | Implemented | Tenant-scoped communities, channels, posts, moderation |
| Content | Implemented | Draft/publish media, feed, follows, engagement |
| Monetization | Implemented | Membership products, verified payments, creator earnings |
| Events | Stubbed | `501 NOT_IMPLEMENTED` |
| AI | Stubbed | `501 NOT_IMPLEMENTED` |
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
- Live providers require their own credentials and are not implemented in this release

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

Identity, community, content, and payments tests use in-memory stores. They do not require a running PostgreSQL instance. Migrations still need a live database before production use.

## Security

- Never trust client-supplied org, tenant, or payment-success flags
- Refresh-token reuse revokes the session
- Production rejects placeholder `AUTH_SECRET`, local `DATABASE_URL` defaults, memory storage, and sandbox payments
- Media blobs are not stored in PostgreSQL
- Webhook signatures are compared with a constant-time check
