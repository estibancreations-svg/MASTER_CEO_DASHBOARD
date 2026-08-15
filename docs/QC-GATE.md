# Architect Accountability and Quality Gate

## Current release status — 2026-08-15

**Status: QC HARDENING IN PROGRESS — not production-certified.**

The application is deployed and its internal data structures are operational. Builder mode intentionally bypasses login and uses seeded interface records. External provider execution and protected production writes remain disabled until identity is restored and each connector passes activation testing.

## Verified in this batch

- Production URL returns HTTP 200.
- Latest Vercel production deployment is READY.
- No Vercel runtime errors were reported in the seven-day inspection window.
- GitHub main contains merged work through PR #17.
- Supabase is ACTIVE_HEALTHY.
- Public application tables report RLS enabled.
- Builder data is explicitly labeled as seeded—not live business performance.
- Document title, accessible icon labels, dialog naming, visible keyboard focus, reduced-motion handling, and narrow-screen overflow safeguards are included.

## Remaining release gates

- [ ] Restore required authentication and organization membership enforcement.
- [ ] Re-test Architect, delegated, denied, expired-session, and sign-out paths.
- [ ] Enable or document the Supabase leaked-password protection decision.
- [ ] Require JWT verification or an equivalent signed boundary for every externally callable Edge Function.
- [ ] Run authenticated create, lifecycle-transition, audit, and realtime tests.
- [ ] Activate providers one at a time with server-side secrets and synthetic preview data.
- [ ] Verify VisionWeaver project → scene → render → review.
- [ ] Verify GrantOS discovery → evidence → authorization → submission.
- [ ] Verify LandWeaver intake → diligence → financial review → approval.
- [ ] Verify THELMA request → model routing → sourced response → cost record.
- [ ] Verify EC Fabric job → retry → dead letter → human override.
- [ ] Complete iPad, iPhone, Android, desktop, keyboard, focus, contrast, empty, degraded, failure, retry, backup, and rollback tests.
- [ ] Reconcile runtime status and connection registry after each provider activation.

## Promotion rule

A deployed interface is not a production-certified operating system. Promotion requires evidence across browser → application → API → database/provider → response → audit trail. Seeded, staged, registered, degraded, connected, and production states must remain visibly distinct.
