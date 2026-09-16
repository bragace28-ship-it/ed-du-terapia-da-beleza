# ED & DU | Terapia da Beleza — Project Rules

## Non-negotiable product rules
- Preserve the currently approved visual layout exactly. Do not redesign, modernize, recolor, reposition, rename, or remove existing UI without an explicit product requirement.
- Implement real functionality behind the existing UI. Do not replace working screens with a new design.
- Production dashboards and financial figures must come from the database; no fake, demo, seeded, or hardcoded production numbers.
- Every visible action, form, filter, table, card, and workflow must have a real implementation or an explicit disabled state.

## Target architecture
- Frontend: Vite/static web app, deployable to Cloudflare Pages.
- Edge/API: Cloudflare Workers when backend endpoints are required.
- Database: standard PostgreSQL on the existing Neon project `divine-dew-72623617`.
- Storage: Cloudflare R2 when object storage is required.
- Git source of truth: this repository.
- Keep PostgreSQL portable; avoid Cloudflare-specific database coupling when Neon can remain the system of record.

## Security
- Never put payment secrets, database passwords, private keys, or API tokens in frontend code, committed files, logs, or client-visible configuration.
- Backend-only secrets must be stored in the deployment environment.
- Webhooks are the source of truth for payment confirmation. Validate signatures and make webhook handling idempotent.
- Enforce roles and permissions server-side; UI hiding is not authorization.
- Keep audit history for financial, payment, inventory, and administrative changes.

## Payments
- Preserve the payment choice flow: Pix or credit card after saving/submitting an order for payment.
- Support Stripe, PagBank, and Asaas through adapters.
- Route credit-card payments by actual expected net value after fees, not by advertised fee alone.
- Persist gateway, method, installments, gross, fee, fee amount, net, external transaction id, status, timestamps, and webhook/event data.
- Never duplicate revenue on repeated webhook events; never delete original financial records for refunds/cancellations.

## Database migration
- The repository currently contains legacy Supabase-oriented code/migrations. Do not assume the Neon database is populated.
- Before production cutover, reconcile the application data model with the actual Neon schema and create versioned PostgreSQL migrations.
- Do not destroy or overwrite existing data during migration.

## QA
- Run build and smoke checks before deployment.
- Verify authentication, CRUD, appointments, orders/comandas, inventory, financial calculations, Pix, credit-card routing, webhook idempotency, dashboard aggregation, and mobile layout.
- Do not declare production-ready solely because a build succeeds.
