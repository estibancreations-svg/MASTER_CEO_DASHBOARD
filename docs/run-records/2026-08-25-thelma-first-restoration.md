# THELMA-FIRST RESTORATION — 2026-08-25

## Purpose
Restore THELMA AI as the intelligence/orchestration front door of the EC Enterprise OS before continuing broader CEO-system reconstruction.

## Live Supabase work
Project: `yqealeekngxooyoemfba`

Applied migrations:
- `20260825173429_thelma_ai_runtime_schema`
- `20260825173507_seed_thelma_minions_and_bounded_grants`
- `20260825173526_activate_white_blood_cell_monitor`
- `20260825174016_remove_fabric_generic_false_success`

Deployed Edge Function:
- `thelma-ai` v2
- verify_jwt: `true`
- runtime grant enforcement: `agent_capability_is_active(...)`

## Restored agent organization
- THELMA AI — Chief Intelligence & Operations Orchestrator
- H.E.N.R.Y. — strategy / architecture / root cause
- L.I.L.Y. — training / explanation / operator guidance
- P.E.R.C.Y. — security / governance / air-gap
- V.E.R.I.T.A.S. — evidence / truth / verification
- C.O.R.E. — compliance / legal-policy
- The Auditor — QC / release certification
- Canon Keeper — memory provenance / supersession
- White Cell — Classifier
- White Cell — Root Cause
- White Cell — Patch Planner
- White Cell — Sandbox
- White Cell — Regression
- White Cell — Recovery

## Permission model
Low-risk intelligence paths are active only through explicit capability grants. Every THELMA/specialist action checks the active grant at runtime and writes ALLOW/DENY evidence to `agent_security_events`.

Enabled without human approval:
- Analyst Memory read
- root-cause analysis
- operator explanation
- security review
- evidence verification
- compliance review
- QC verification
- memory verification
- WBC classification / root cause / repair planning / regression analysis

Approval-gated:
- THELMA repair dispatch
- White Cell Sandbox
- White Cell Recovery
- destructive/external/credential/financial/deployment/code changes

## White Blood Cell control plane
`refresh_white_blood_cells()` converts confirmed problems into repair signals and runs every five minutes.

First production sweep:
- active Analyst findings touched: **58**
- unresolved Fabric dead-letter conditions touched: **1**
- recent failed VisionWeaver generations touched: **3**

Each signal can now be diagnosed, assigned to a specialist, turned into a bounded repair plan, and independently verified against source evidence.

## Execution-truth correction
`ec_process_queue_once` no longer marks unknown workflow keys complete.

Certified handlers remain limited to real implementations such as:
- `system-health-pulse`
- `vision-production-intake`

`agent-command-dispatch` now fails explicitly because its old generic path did not perform agent work.

## UI branch work
Branch: `thelma-first-restoration`

Added:
- `src/components/ThelmaAIConsole.tsx`
- live Ask THELMA chat
- White Blood Cell signal/repair console
- specialist roster
- repair plan + verification controls
- model/provider display

Updated:
- `src/components/ThelmaWorkspace.tsx`
- `src/thelma.css`
- `src/routing.ts`

Agent Hub and Agent Logs now resolve to `/systems/thelma` rather than the generic `ModulePage` shell.

## Known boundary / not falsely certified
THELMA does **not** yet have a governed GitHub source-code repair executor inside Supabase. No GitHub write credential is stored there. Source-code repair therefore remains a separately tracked requirement:
`THELMA-CODE-REPAIR-EXECUTOR-MISSING`.

Required future executor flow:
`repair plan -> approval -> isolated branch -> patch -> tests -> PR -> Quality Gate -> merge -> deployment -> independent verification`

Do not solve this with a broad personal access token.

## Certification state
Backend runtime: installed and active.
UI: branch implementation complete, pending PR Quality Gate and production merge.
Authenticated real-user chat/model response: pending post-deployment certification.
