# Architect Accountability and Quality Gate

## Current release status — 2026-08-15

**Status: QC HARDENING IN PROGRESS — not production-certified.**

The application is deployed and its provider-independent workflows are certified. Builder mode intentionally bypasses login and uses seeded interface records. External provider execution and protected production writes remain disabled until identity is restored and each connector passes activation testing.

## Verified

- Production URL returns HTTP 200 and the latest Vercel production deployment is READY.
- No Vercel runtime errors were reported in the inspected window.
- GitHub main contains merged work through PR #20 before this hardening branch.
- Supabase is ACTIVE_HEALTHY and public application tables report RLS enabled.
- Builder data is explicitly labeled as seeded—not live business performance.
- Document metadata, accessible icon labels, dialog naming, keyboard focus, reduced-motion handling, and narrow-screen safeguards are included.
- Rollback-safe internal workflow certification passed for LandWeaver, VisionWeaver, GrantOS, THELMA, EC Integration Fabric, and CMGIO; zero synthetic rows persisted.
- All six attached production workspaces launch and render their governed builder boundaries.
- EC Fabric now enforces valid job transitions, authorization, retry exhaustion, dead-letter evidence, ASK-based human requeue, automatic event history, and append-only audit records at the database boundary.

## Remaining release gates

- [ ] Restore required authentication and organization membership enforcement.
- [ ] Re-test Architect, delegated, denied, expired-session, and sign-out paths.
- [ ] Enable or document the Supabase leaked-password protection decision.
- [x] Require JWT verification or an equivalent signed boundary for every externally callable Edge Function.
- [ ] Run authenticated create, lifecycle-transition, audit, and realtime tests.
- [ ] Activate providers one at a time with server-side secrets and synthetic preview data.
- [x] Verify VisionWeaver internal project → scene → review → completion state path.
- [x] Verify GrantOS internal discovery → evidence → authorization-ready drafting path.
- [x] Verify LandWeaver internal intake → diligence → financial review → approval path.
- [x] Verify THELMA internal request → authorization → run → incident-resolution path.
- [x] Verify EC Fabric job → retry → dead letter → human override, with immutable evidence.
- [x] Verify CMGIO internal campaign → asset QC → signal action → completion path.
- [ ] Verify THELMA request → live model routing → sourced response → cost record.
- [ ] Complete iPad, iPhone, Android, desktop, keyboard, focus, contrast, empty, degraded, failure, retry, backup, and rollback tests.
- [ ] Reconcile runtime status and connection registry after each provider activation.

## Promotion rule

A deployed interface is not a production-certified operating system. Promotion requires evidence across browser → application → API → database/provider → response → audit trail. Seeded, staged, registered, degraded, connected, and production states must remain visibly distinct.


### Edge Function boundary certification — 2026-08-15

- `dashboard-data`: platform JWT verification plus server-side user validation, executive `app_metadata.role` authorization, canonical production-origin CORS, and current publishable/secret-key compatibility.
- `visionweaver-orchestrator`: Vault-backed bearer secret, constant-time digest comparison, method restriction and signed health route.
- `oauth-callback`: public by protocol, bounded by platform binding, expiring one-time state, atomic consume-before-exchange, method restriction and secure token-storage checks.

Builder-mode login remains intentionally deferred; this completed gate certifies endpoint boundaries, not full authenticated application launch.
