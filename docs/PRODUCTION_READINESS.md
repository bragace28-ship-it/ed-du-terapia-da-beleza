# ED & DU — Cloud production readiness

## Target architecture

- **Frontend:** Cloudflare Pages.
- **Server-side API:** Cloudflare Pages Functions.
- **Primary database:** Neon PostgreSQL.
- **Supabase:** not used as the application data authority; the existing Supabase project is currently inactive and the immutable V33 build rejects Supabase runtime references.
- **Payments:** Asaas sandbox/production endpoint prepared with Neon persistence and webhook idempotency.
- **Google Calendar:** client-side sync contract already targets `/api/google-calendar`; OAuth credentials and the server endpoint still require configuration before the calendar test is marked PASS.

## Safety gates

The production workflow must not deploy merely because the static site builds. The cloud-preflight gate requires the production Neon secret and payment provider secret before production deployment is allowed.

The immutable V33 visual baseline remains unchanged. Functional/cloud code is additive.

## Database reset policy

`db/002_reset_demo_data.sql` is deliberately separate from schema creation. It removes transactional/demo data while preserving:

- `coupons`
- `services`
- `gift_cards`
- `app_settings`

It does not seed passwords or PINs. Neon Auth identities must be created first and then linked in `app_users`.

## 86-item rule

The 86-item matrix is a homologation contract, not proof that every item is production-integrated. A production PASS requires the corresponding UI action, backend persistence/API behavior, and relevant external integration to be exercised without error.

## Current preparation status

- Immutable V33 checks remain green on the pull request branch.
- Neon/Asaas server-side files are present, but live credentials and live database mutation have intentionally not been performed yet.

## Remaining credential-dependent steps

1. Neon production branch/connection string available to Cloudflare as `NEON_DATABASE_URL`.
2. Neon schema applied.
3. Demo/test rows reset while preserving configuration/catalog tables.
4. Final email addresses supplied for Edgar Ferreira da Silva and Carlos Eduardo Braga; create their Neon Auth identities and link them as administrators.
5. Google Cloud OAuth credentials configured and organizer calendar authorized.
6. Asaas sandbox credentials configured for payment tests; webhook URL registered with a secure webhook token.
7. Execute the 86-item end-to-end test matrix against the cloud environment.
8. Only after the above passes, merge the preparation branch into the approved production branch.

## Important

No production deployment should be declared successful solely from `npm run build`. The application needs a live database/API test and external integration tests.
