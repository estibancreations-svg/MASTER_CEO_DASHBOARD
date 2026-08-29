# VisionWeaver Long-Form Release — 2026-08-28

## Production contract

- Short video remains governed at the existing short-form route.
- Long-form video accepts explicit runtimes through 10 minutes in Studio.
- Long-form Studio generations use Runway Seedance 2.5 with provider segments no longer than 30 seconds.
- `extend` continuity waits for the previous durable segment and supplies that completed video as the next segment's continuation source.
- New Project orchestration supports up to 120 sequential scenes at the database layer, matching the orchestrator's governed maximum.
- Both Studio and project orchestrator run on one-minute durable schedulers.

## Master assembly

Completed multi-shot video sequences are detected globally while an authenticated dashboard session is active. The application invokes `/api/visionweaver-assemble`, which:

1. verifies the Supabase user token;
2. verifies ownership of the parent generation and all child segments;
3. requires a complete, non-partial multi-shot video;
4. reads only owner-scoped signed URLs from `visionweaver-outputs`;
5. concatenates compatible MP4 segments with ffmpeg stream copy (`-c copy`), avoiding a second AI render and avoiding quality loss from transcoding;
6. writes a new immutable master object into the owner's `masters/` directory;
7. updates the generation so the master becomes the first durable playable output; and
8. records the master in `vw_assets`.

The assembler never requires a Supabase service-role secret in Vercel. It uses the signed-in user's RLS-scoped publishable-key session.

## Guardrails

- Studio video maximum: 600 seconds per request.
- Project scene capacity: 120 sequential scenes.
- Studio long-form provider-shot maximum: 30 seconds.
- Assembler maximum: 20 segments for Studio's current 10-minute, one-variant production contract.
- Existing short project segment default remains 5 seconds unless a runtime is explicitly requested.
- Failed or partial sequences do not auto-assemble.
- Automatic assembly retries are throttled after a failure.
- Master objects are created with unique names and `upsert: false`, so owner storage requires only the existing INSERT + SELECT policies.

## Deployment checks

- Vercel preview build: READY after TypeScript validation.
- Vercel detects the assembler as a Node function.
- `ffmpeg-static@5.3.0` is pinned and explicitly approved in `allowScripts` so the binary installation step is not silently blocked.
- Supabase `visionweaver-orchestrator` is ACTIVE.
- Supabase `visionweaver-studio` is ACTIVE.
- `visionweaver-studio-tick` cron is active every minute.
- `visionweaver-orchestrator-tick` cron is active every minute.

## 2026-08-29 Quality Gate addendum

PR #45 synchronized the active Supabase `visionweaver-studio` v22 source into GitHub after this release. That merge exposed a packaging defect: `package.json` referenced `ffmpeg-static@5.3.0`, but `package-lock.json` had not been updated. GitHub Quality Gate failed before TypeScript, tests, release evidence, or production build could run.

Failure evidence:

- PR #45 Quality Gate run `33215733581` failed at `Install locked dependencies`.
- Post-merge `main` Quality Gate run `33215745553` failed at `Install locked dependencies`.
- Root cause: `npm ci` rejected the package/lockfile mismatch and reported `ffmpeg-static@5.3.0` plus transitive packages missing from the lockfile.

Corrective rule: every VisionWeaver release that changes `package.json`, runtime assembly dependencies, Vercel function packaging, or install-script approval must update and verify `package-lock.json` in the same PR. Vercel success alone is not sufficient release evidence.
