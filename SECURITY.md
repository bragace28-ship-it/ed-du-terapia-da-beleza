# ED & DU — Security Baseline

This project treats security as a release gate, not a feature toggle.

## Implemented in this branch

- Browser hardening headers in the Nginx container: anti-clickjacking, MIME sniffing protection, restrictive referrer policy, Permissions-Policy, COOP/CORP and CSP.
- Environment files, backups, VCS metadata, certificates and private keys excluded from Docker build context.
- Backend-only webhook ledgers explicitly deny direct `anon` and `authenticated` table access.
- Anonymous execution revoked for the privileged payment/command RPCs flagged by the database security audit.
- Mutable `search_path` fixed for `set_pix_updated_at` and `simulate_payment_gateways`.
- CI dependency audit at `high` severity or above.
- CI tracked-source secret pattern scan.
- No provider secret belongs in frontend JavaScript, Git, the Docker image or chat.

## Required before production exposure

1. Run the full Cloud export and keep an immutable copy before any migration/reset.
2. Restore the database locally and run `supabase db lint` plus database tests.
3. Verify every table containing customer, appointment, clinical/photo or financial data has intentional RLS and least-privilege policies.
4. Verify all privileged `SECURITY DEFINER` functions have fixed `search_path`, narrow arguments, ownership/role checks and no unsafe dynamic SQL.
5. Keep webhook endpoints unauthenticated at the HTTP JWT layer only where the provider requires it; authenticate the provider signature/token and enforce event-id idempotency inside the function.
6. Configure leaked-password protection and authentication policies in the Supabase Auth deployment. This cannot be safely enabled by this static frontend repository alone.
7. Configure TLS at the reverse proxy and enable HSTS only after HTTPS is guaranteed.
8. Store payment-provider secrets only in server-side environment/secret storage. Rotate any secret that has ever been exposed in chat, logs or source control.
9. Use sandbox credentials for local homologation. Real payment credentials are only installed after the application passes the local security and E2E gates.
10. Do not expose Supabase Studio, Postgres or internal service ports directly to the Internet.

## Payment security rules

- Pix: PagBank only.
- Credit card: the professional's selected gateway (PagBank, Stripe or Asaas).
- PicPay is future-only and is not an active routing target for Pix.
- Never trust a browser success/return URL as proof of payment.
- Financial settlement occurs only from verified provider webhooks/server responses.
- Webhooks must be idempotent because providers may retry the same event.
- Client-side totals are display data; authoritative amount, ownership and command state are validated server-side.

## Incident rule

If a secret is exposed, assume compromise: revoke/rotate it at the provider, replace the deployment secret, inspect provider activity and only then resume testing. Never paste the replacement secret into an issue, commit, log or chat.
