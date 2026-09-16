# ED & DU — Cloudflare Production

## Runtime

- Cloudflare Pages + Pages Functions
- Neon Auth + Neon Data API for browser authority
- Neon PostgreSQL for application data
- Server-side payment adapters under `functions/api/payments`
- Static routes remain outside Pages Functions via `public/_routes.json`

## Required Cloudflare secrets

Never commit these values to GitHub or browser code.

- `DATABASE_URL` — Neon production connection string
- `STRIPE_SECRET_KEY` — Stripe production secret key
- `STRIPE_WEBHOOK_SECRET` — Stripe endpoint signing secret
- `PAGBANK_ACCESS_TOKEN` — PagBank production token
- `ASAAS_API_KEY` — Asaas production API key
- `ASAAS_WEBHOOK_TOKEN` — Asaas webhook auth token

Optional:

- `ASAAS_BASE_URL` — defaults to `https://api.asaas.com`
- `PAGBANK_BASE_URL` — defaults to `https://api.pagseguro.com`

## Webhooks

- `/api/payments/webhook/stripe`
- `/api/payments/webhook/pagbank`
- `/api/payments/webhook/asaas`

Webhook processing is idempotent through `webhook_events` and payment idempotency keys. Financial confirmation is driven by webhook status, not the browser redirect.

## Payment flow

1. The app selects Pix or credit card.
2. The Smart Gateway ranks configured gateways by calculated net amount.
3. The server creates the hosted checkout using only server-side credentials.
4. The transaction is persisted as pending/processing.
5. The gateway webhook authenticates the event and updates the payment.
6. A confirmed payment updates the command to `PAGA` and creates the corresponding financial entry once.
