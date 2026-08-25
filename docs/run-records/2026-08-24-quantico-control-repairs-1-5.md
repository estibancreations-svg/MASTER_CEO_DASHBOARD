# Quantico Control Repairs 1–5 — 2026-08-24

## Scope
Repair the first five second/third-order defects identified in `2026-08-24_QUANTICO-AUDIT-ADDENDUM-II.md` before asking the Architect for additional decisions.

## 1. Test architecture — REPAIRED BASELINE
- Added `npm test` using Node's built-in test runner.
- Added `tests/release-invariants.test.mjs`.
- Added `npm run verify:release` and `npm run quality`.
- Current machine gate checks critical system routes, canonical module naming, anti-placeholder behavior and QC certification language.
- This is the baseline test architecture; deeper DB/RLS/provider/E2E/agent evaluation suites remain future capability-specific work.

## 2. CI/CD and promotion controls — REPAIRED BASELINE
- Added `.github/workflows/quality-gate.yml`.
- Quality Gate performs locked dependency install, TypeScript gate, invariant tests, release evidence guard and production build.
- Added `docs/operations/RELEASE-PROMOTION-POLICY.md` with preview/staging/production, rollback and release-bound evidence rules.
- GitHub Actions run `32806406853` completed successfully on commit `92125445c8b553ceb03fabb6f5c315067d58a65d`.
- Vercel production deployment for that commit is READY: `dpl_Bt6ZE7tZzhSniBf439ZVPBixPMUL`.
- Account-level branch protection enforcement is `EXTERNAL-ADMIN-REQUIRED` because the connected GitHub integration cannot read/write branch-protection settings.

## 3. QC evidence drift — REPAIRED CONTROL MODEL
- Replaced the stale August 15 checklist as current authority.
- QC status is explicitly `CANONICAL RECONSTRUCTION / QC HARDENING — not production-certified`.
- Added release-bound evidence fields and evidence states: CERTIFIED, PARTIAL, STALE-UNVERIFIED, FAILED, NOT-IMPLEMENTED, NOT-APPLICABLE.
- Prior evidence is automatically treated as stale when relevant code/configuration/schema/workflow changes.

## 4. Recovery/security finding drift — REPAIRED DATA MODEL
- Applied live Supabase migration `20260825034314_version_recovery_security_findings`.
- Added observed release/time, verification time/state/evidence, remediation reference and regression-test reference fields.
- Revalidated historical findings against live RLS/Edge Function state.
- Current verification result: 8 FIXED, 4 OPEN.
- Added `recovery.active_security_findings` so stale/superseded history is excluded from current remediation views.
- Persisted the migration in GitHub with the matching live migration version.

## 5. Schema reconciliation — REPAIRED BASELINE
- Applied live Supabase migration `20260825034527_seed_quantico_schema_reconciliation`.
- `recovery.schema_reconciliation` now has 40 rows across 8 systems, replacing the previous zero-row state.
- Systems: CEO, VisionWeaver, THELMA, EC Fabric, GrantOS, LandWeaver, MAP, ClimateTrack.
- Each system now has five mapped sections: Identity/access, Domain state, Workflow/execution, Observability/audit, Canonical gaps.
- Each row includes live evidence summary and next action.
- Persisted the matching migration in GitHub.

## Gate result
Repairs 1–5 have passed their current baseline gates. These repairs establish trustworthy reconstruction controls; they do not certify the business systems themselves as complete.
