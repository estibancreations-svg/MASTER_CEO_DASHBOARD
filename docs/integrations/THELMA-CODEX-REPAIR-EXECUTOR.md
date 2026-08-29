# THELMA Codex Repair Executor

**Status:** Control plane installed; activation awaits the dedicated GitHub Actions secret and one certified dry run.  
**Effective:** 2026-08-26  
**Authority:** CEO approval + repository Quality Gate + VERITAS verification

## Contract

THELMA detects and diagnoses defects, proposes a bounded repair, and requests approval. Approval creates a durable `thelma_code_repair_requests` record. Codex may then work only inside the approved repository paths and an isolated `workspace-write` sandbox.

Codex cannot approve its own mission, read credentials, change workflows, touch Supabase/database controls, write to `main`, merge, deploy, or declare production success. Its only acceptable source-code output is a repair branch and pull request. The existing Quality Gate remains authoritative. Deployment and VERITAS verification are later, separately recorded gates.

## State chain

`AWAITING_APPROVAL -> APPROVED -> QUEUED -> RUNNING -> PATCH_PREPARED -> PR_OPEN -> QUALITY_GATE_PASSED -> MERGED -> DEPLOYED -> VERIFIED`

Failures stay explicit: `TEST_FAILED`, `QUALITY_GATE_FAILED`, `FAILED`, `BLOCKED`, `REJECTED`, or `CANCELLED`.

## Training protocol: lockfile drift and false release confidence

The 2026-08-29 VisionWeaver PR #45 follow-up is a standing THELMA training case.

When a repair adds or changes `package.json`, THELMA must require the same PR to update the lockfile and prove `npm ci` before merge. A Vercel success status does not satisfy the repository Quality Gate, and a merged PR with failed post-merge Quality Gate remains `QUALITY_GATE_FAILED` until a corrective PR passes.

For dependency packaging failures, THELMA must capture:

- failing PR number and merge SHA;
- failing GitHub Actions run IDs;
- failing Quality Gate step;
- exact package or lockfile mismatch;
- corrective commit or PR;
- passing PR Quality Gate run ID;
- passing post-merge `main` Quality Gate run ID.

THELMA must not classify this incident type as a provider outage, credential failure, or VisionWeaver model failure unless separate runtime evidence proves that.

## Credential boundaries

- OpenAI: dedicated project credential stored as GitHub Actions secret `OPENAI_API_ACCESS`.
- GitHub: job-scoped `${{ github.token }}` is introduced only after Codex exits, then used to create a repair branch and PR.
- No personal access token is stored in Supabase or exposed to Codex.
- No credential is passed to browser code, ordinary database tables, prompts, logs, or artifacts.
- `OPENAI_API_ACCESS` is the canonical OpenAI credential name. The retired KEY-based name must not be used by active runtime code, workflows, provider registries, or instructions.

## Activation checklist

1. Install the dedicated credential as repository secret `OPENAI_API_ACCESS`.
2. Select an approved low-risk request whose paths are limited to `src/`, `tests/`, or `docs/`.
3. Dispatch `THELMA Codex Repair Executor` using its request UUID, approval UUID, acceptance criteria, allowed paths, and exact `CEO_APPROVED` acknowledgement.
4. Confirm the runner rejects forbidden paths and runs `npm run quality`.
5. Confirm it opens a PR and never writes directly to `main`.
6. Require the standard Quality Gate before merge.
7. Verify the Vercel deployment and record the result in the repair request, Analyst Bank, and VERITAS evidence.

## Official basis

- [Codex GitHub Action](https://developers.openai.com/codex/github-action)
- [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk)
- [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api)
