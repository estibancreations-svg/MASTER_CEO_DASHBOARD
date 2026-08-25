# Release Promotion Policy

## Purpose
Prevent a successful build or deployment from being treated as proof that the Estiban Creations operating system is functionally complete.

## Required environments
1. **Preview** — generated for pull requests and non-main branches.
2. **Staging** — production-like configuration using synthetic/non-destructive data and provider sandboxes where available.
3. **Production** — promoted only after all required checks and evidence are green for the exact release candidate.

## Required quality gate
Every candidate must pass:
- TypeScript/static checks (`npm run lint`)
- machine-checkable invariant tests (`npm test`)
- release evidence guard (`npm run verify:release`)
- production build (`npm run build`)
- migration review and backward-compatibility check for database changes
- authenticated workflow verification for changed primary journeys
- security/RLS verification for changed tables/functions
- provider contract verification for changed external integrations

## Release-bound evidence
Every production certification must record:
- Git commit SHA
- Vercel deployment ID
- Supabase migration set / schema state
- Edge Function name + version for changed functions
- provider configuration version/verification date
- test/evaluation evidence
- known limitations and explicitly deferred capabilities

Evidence from an earlier release does not automatically certify a later release.

## Promotion rule
A release may not be called production-certified because:
- Vercel says READY;
- a route returns HTTP 200;
- a queue emptied;
- a database row reached `completed`;
- a seeded/synthetic workflow changed state;
- a UI control rendered or accepted a click.

Promotion requires evidence from browser/user action through application/API/workflow/provider/database response, resulting artifact or business state, validation, audit trail, and expected failure recovery for the primary workflow under test.

## Rollback
For every production release:
1. retain the prior Vercel deployment as rollback candidate;
2. document database migration reversibility or forward-fix plan;
3. avoid destructive migrations without verified backup/restore evidence;
4. record Edge Function rollback version;
5. stop promotion if rollback cannot be performed safely.

## Environment truth labels
All user-visible and operational data must distinguish:
- DEMO
- SYNTHETIC TEST
- STAGING
- PRODUCTION
- DEGRADED
- NOT IMPLEMENTED

No unsupported capability may report `completed` or `healthy` solely because its transport/state machine succeeded.
