# Architect Accountability and Quality Gate

## Current status — 2026-08-24

**Status: CANONICAL RECONSTRUCTION / QC HARDENING — not production-certified.**

The application is deployed, but deployment availability is not accepted as proof of business-function completion. The August 15 checklist is retained only as historical evidence because authentication, navigation, Fabric behavior, workspace controls, and reconstruction requirements changed after that certification pass.

## Release-bound evidence rule

Every QC claim must be bound to the exact release it tested. A certification record must identify:

- Git commit SHA;
- Vercel deployment ID;
- Supabase migration/schema state;
- changed Edge Function names and versions;
- provider/configuration verification date;
- automated test/evaluation evidence;
- primary workflow evidence from request through real output/business side effect;
- failure/recovery evidence;
- known limitations and deferred capabilities.

If relevant code, schema, policy, Edge Function, provider configuration, or workflow logic changes, earlier evidence becomes **STALE-UNVERIFIED** for the affected capability until re-tested.

## Current verified infrastructure facts

- The production application has an active Vercel deployment path.
- Supabase is the production database/auth/runtime foundation.
- EC Fabric durable queues, state transitions, retries, dead-letter handling and audit infrastructure exist.
- VisionWeaver has active production Edge Functions and provider integration code.
- Authentication has been restored to the production application, with social-provider buttons guarded by live provider enablement.
- The repository now contains an automated `Quality Gate` GitHub Actions workflow.
- `npm run quality` now performs type checks, machine-checkable invariant tests, release-evidence verification and the production build.

These facts certify infrastructure only. They do **not** certify that every named business workflow performs its intended domain work.

## Known reconstruction blockers

- [ ] Replace generic EC Fabric success fallback with explicit registered workflow handlers; unsupported workflows must not report completion.
- [ ] Implement real THELMA conversation/model routing, sourced response, tool execution and cost evidence.
- [ ] Reconstruct the full canonical agent organization and capability registry.
- [ ] Replace generic Master Dashboard modules with their own capability/read/action contracts.
- [ ] Restore omitted systems and canonical packages identified in the reconstruction audit.
- [ ] Complete field-level schema reconciliation for every canonical system capability.
- [ ] Recompute system readiness from evidence rather than legacy percentages.
- [ ] Revalidate stale recovery/security findings against the live release.
- [ ] Complete authenticated lifecycle/RLS matrix tests.
- [ ] Activate and certify external providers one at a time.
- [ ] Enable or explicitly disposition Supabase leaked-password protection.
- [ ] Complete backup run and isolated restore drill with RPO/RTO evidence.
- [ ] Complete physical iPad/iPhone/Android/desktop spot checks against the rebuilt product workflows.

## Promotion rule

A deployed interface is not a production-certified operating system. A route returning HTTP 200, a Vercel `READY` state, a queue becoming empty, a database row reaching `completed`, or a synthetic state-machine test is insufficient.

Primary workflow promotion requires:

`SOURCE -> CONTRACT -> IMPLEMENTATION -> AUTHORIZATION -> EXECUTION -> OUTPUT -> VALIDATION -> AUDIT -> FAILURE RECOVERY -> TEST -> RELEASE EVIDENCE`

All links applicable to the workflow must be demonstrated for the exact release candidate.

## Evidence states

Use only:

- `CERTIFIED` — evidence is current and bound to this release.
- `PARTIAL` — some required evidence exists, but promotion gates remain.
- `STALE-UNVERIFIED` — previously tested, but relevant implementation/configuration changed.
- `FAILED` — required evidence disproved the claim.
- `NOT-IMPLEMENTED` — capability contract exists but executable implementation does not.
- `NOT-APPLICABLE` — gate does not apply and rationale is recorded.

## Historical note — 2026-08-15

The former QC record reported provider-independent workflow checks, responsive/accessibility checks, database transition tests, and Edge Function boundary work. Those results remain useful historical evidence, but they no longer certify the current release after subsequent authentication, Fabric, THELMA, navigation, workspace, and reconstruction changes.

See `docs/operations/RELEASE-PROMOTION-POLICY.md` for the active promotion policy.
