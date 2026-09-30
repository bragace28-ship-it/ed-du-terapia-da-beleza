# Master V46 — Final Homologation Gate

This branch is the controlled gate between local Master V46 validation and real cloud testing.

## Immutable rules
- V33 baseline remains untouched.
- Master V46 is deployed only with MASTER_DEPLOY=1.
- Production is blocked until cloud credentials and E2E tests pass.
- The 86-item matrix is a test contract, not proof of completion.

## Gate order
1. Master V46 syntax and matrix validation.
2. Browser/modal navigation validation.
3. PDF/report/coupon/user-permission/OCR/card-invoice/agenda/gateway validation.
4. Neon schema + seed + persistence tests.
5. Asaas sandbox payment + webhook tests.
6. Google Calendar OAuth + event creation test.
7. Cloudflare preview deployment.
8. Execute all 86 E2E cases.
9. Promote the exact tested commit to production.

## Current status
- Code/preflight preparation: READY.
- Cloud production: NOT DEPLOYED.
- Live Neon mutation: NOT PERFORMED.
- Asaas sandbox: NOT HOMOLOGATED.
- Google Calendar: NOT HOMOLOGATED.
- 86 E2E: NOT COMPLETE.
