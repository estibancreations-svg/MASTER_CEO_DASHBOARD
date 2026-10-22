# THELMA release diagnostics and governed deployment handoff

## Status (2026-10-09)
The deployed `thelma-ai` Supabase function is active, and the authenticated VisionWeaver UI now has **Run THELMA diagnostics**. This explicitly invokes `refresh_white_cells` followed by `chat`, and displays the returned evidence. It requires an authenticated user with the appropriate agent grants. **Opening a GitHub PR, writing a WBC signal, or seeing an agent marked online does not mean THELMA has executed.**

The release failure from PR #64 / Quality Gate run 37992021512 is registered in `white_blood_cell_signals` (signal `0934906f-d7af-45e1-ad66-633200b11a00`), state OPEN, assigned to THELMA. It is a diagnostic directive, not proof of agent execution.

## Mandatory per-system handoff
1. Before promotion, identify system, target branch, immutable SHA, Vercel project, affected routes, schema/Edge Function versions, rollback SHA, and changed components.
2. Run locked dependency installation, TypeScript, invariant tests, release guard, and production build. Reject any failure. Compare desktop and mobile UI against approved screenshots; check navigation destinations and auth/session boundaries.
3. Run **THELMA diagnostics** from the authenticated UI, or a future certified machine-to-machine integration. Send her the exact SHA, failed/passed gate evidence, affected systems, risk boundaries, and rollback. Do not claim a scan was run merely because a WBC record exists.
4. Await THELMA's real diagnostic response. Store a response ID, timestamp, agent/model identity, evidence links, findings and unresolved risks. Auditor/VERITAS review must distinguish verified checks from agent claims.
5. For code changes, credentials, deployment, billing or provider-spend actions, require the authorized human approval and certified executor. Do not let a model self-approve its own changes.
6. Promote only the SHA that passed gates and THELMA verification. After promotion, recheck live authenticated routes, health and browser screenshots; record Vercel deployment ID and rollback path.
7. Feed failed tests, root-cause corrections and approved decisions back into versioned test cases and the governed Analyst Memory Bank. No unreviewed production data is used as a training label.

## Remaining automation dependency
There is **not yet a verified signed GitHub/Vercel-to-THELMA service-to-service callback with a release acknowledgment**. The interactive diagnostic works only when a signed-in user invokes it; automatic every-deployment invocation and awaiting a machine-verifiable response must not be represented as complete. A separate approved service identity, scoped token, webhook signature verification, replay protection, delivery retry, and release-policy enforcement are required before unattended deployment handoffs are enabled.

## Existing constraints
- No implicit provider spending from page load, refresh or diagnostics.
- No auto-merge when the Quality Gate is red.
- No synthetic green badges or completion states.
- Keep Avatar State and the locked capsule gate ahead of Shot 02 continuation.
