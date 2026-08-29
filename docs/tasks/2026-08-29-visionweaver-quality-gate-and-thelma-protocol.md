# VisionWeaver Quality Gate Repair And THELMA Protocol Task

**Date opened:** 2026-08-29  
**Authority:** The Architect / Base Ten Standard  
**Primary repo:** `estibancreations-svg/MASTER_CEO_DASHBOARD`  
**Related issue:** #39  
**Related PRs:** #42, #43, #44, #45  
**Current main SHA at discovery:** `09aa8ebbc2e5b26490f08033921d3b7779974f9c`

## Task

Fix the current VisionWeaver Quality Gate failures, scan for more release-certification gaps like it, and feed the result into THELMA's repair training and operating protocols.

## Blocker Found

PR #45 merged the active Supabase `visionweaver-studio` v22 source back into GitHub, but the GitHub Quality Gate failed on both the PR run and the post-merge `main` push.

| Gate | Run | SHA | Result | Blocking Step |
|---|---:|---|---|---|
| PR #45 Quality Gate | `33215733581` | `91ce296e3382cfa57aa0339b1d11e1fd987095ba` | FAILED | `Install locked dependencies` |
| Main Quality Gate | `33215745553` | `09aa8ebbc2e5b26490f08033921d3b7779974f9c` | FAILED | `Install locked dependencies` |

Root cause:

- `package.json` added `ffmpeg-static@5.3.0`.
- `package-lock.json` was not updated.
- `npm ci` therefore refused to install and never reached TypeScript, tests, release evidence, or production build.

This is a release packaging failure, not proof that the VisionWeaver runtime logic is broken.

## Required Fix

1. Update `package-lock.json` from the current `main` dependency graph.
2. Confirm the lockfile includes `ffmpeg-static@5.3.0` and its transitive packages.
3. Run the exact Quality Gate chain:
   - `npm ci`
   - `npm run lint`
   - `npm test`
   - `npm run verify:release`
   - `npm run build`
4. Open a targeted PR for the lockfile and protocol updates.
5. Merge only after the exact PR head passes Quality Gate.
6. Confirm the post-merge `main` Quality Gate also passes.
7. Update Issue #39 with the run IDs and final state.

## Scan For More

Before closing this task, scan for:

- dependencies in `package.json` missing from `package-lock.json`;
- scripts or tests that mention a runtime capability without a passing Quality Gate run;
- recent PRs merged with Vercel success but failed or missing GitHub Quality Gate evidence;
- docs that claim VisionWeaver is complete while GitHub certification is failing;
- docs that claim THELMA repair execution is operational before an authenticated chat E2E and governed repair E2E are proven;
- branch protection/ruleset evidence for `main`.

## Additional Finding From Local Quality Gate

After the lockfile was regenerated, the local gate progressed beyond `npm ci` and found a second blocker:

- `tests/gemini-connection-name.test.mjs` failed.
- Failure: `VisionWeaver provider health must read GEMINI_CONNECTION`.
- Root cause: the current `visionweaver-orchestrator` source no longer referenced the canonical Gemini credential slot, while active docs still require VisionWeaver adapters to use `GEMINI_CONNECTION`.

Corrective action in this task:

- restore a non-secret `GEMINI_CONNECTION` provider-slot truth state in `visionweaver-orchestrator` health output;
- keep Runway as the long-form render path;
- do not expose the credential value;
- do not mark Gemini healthy from credential presence alone.

## THELMA Training Protocol

THELMA must treat this incident as a permanent repair lesson:

- A Vercel `success` status does not equal GitHub Quality Gate success.
- `npm ci` failure from lockfile drift is a release-blocking defect, even when production appears deployed.
- Any dependency added to `package.json` requires lockfile verification in the same PR.
- A merged PR with failed post-merge Quality Gate must remain `PARTIAL / BLOCKED` until a corrective PR passes.
- THELMA should classify this as `QUALITY_GATE_FAILED`, not as a provider, credential, or VisionWeaver runtime failure.
- THELMA must record the exact failing run IDs, commit SHA, root cause, corrective commit, and passing run IDs before marking the repair verified.

## Acceptance Criteria

- `package-lock.json` is synchronized with `package.json`.
- PR Quality Gate passes on the exact fix branch head.
- Post-merge `main` Quality Gate passes.
- Issue #39 receives a follow-up with the new run IDs.
- THELMA protocol docs contain this lockfile drift rule.
- Remaining Issue #39 gates stay open unless independently certified.
