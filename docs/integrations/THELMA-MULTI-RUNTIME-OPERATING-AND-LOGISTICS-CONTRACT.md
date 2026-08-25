# THELMA AI Multi-Runtime Operating and Logistics Contract

**Date:** 2026-08-25  
**Canonical system:** Estiban Creations CEO OS  
**Canonical repository:** `estibancreations-svg/MASTER_CEO_DASHBOARD`  
**Canonical data/runtime:** Supabase project `yqealeekngxooyoemfba`

## Purpose

THELMA is one governed enterprise intelligence with multiple delivery surfaces. GitHub, Vercel, Supabase, Replit and Base44 must not become independent or contradictory THELMA brains.

## Authority and responsibility

| Surface | Responsibility | Not authoritative for |
|---|---|---|
| Supabase | Identity, membership, Analyst Memory, agent grants, conversations, messages, White Blood Cell signals, repair plans, audit/tool/security evidence, durable queues | Source-code history or browser presentation |
| GitHub | Canonical source code, migrations, runtime contracts, tests, PR review and release evidence | Live operational state |
| Vercel | Production CEO/THELMA web experience built from tested GitHub main | Agent memory or repair authorization |
| Replit | THELMA Logistics operating companion and future bounded execution workspace | Independent memory, duplicate agent grants, or unverified completion claims |
| Base44 | Logistics/mobile operational surface and configured agents/connectors after reconnection | Replacing Supabase canon or bypassing approval gates |

## Production operating model

The current production path is:

`CEO sign-in -> THELMA UI -> authenticated thelma-ai v2 -> Analyst Memory + capability registry + White Blood Cells -> specialist selection -> proposal/verification -> evidence`

The source-code repair path remains:

`THELMA approved plan -> least-privilege GitHub App executor -> isolated branch -> patch -> tests -> PR -> Quality Gate -> merge -> Vercel -> VERITAS/WBC verification -> Analyst Memory`

A broad personal access token is prohibited.

## THELMA and specialist organization

- THELMA — Chief Intelligence and Operations Orchestrator
- H.E.N.R.Y. — architecture, strategy and root cause
- L.I.L.Y. — operator guidance and training
- P.E.R.C.Y. — security, permissions and Air Gap governance
- V.E.R.I.T.A.S. — evidence and truth verification
- C.O.R.E. — compliance and policy
- The Auditor — quality and release certification
- Canon Keeper — memory integrity and provenance
- WBC Classifier
- WBC Root Cause
- WBC Patch Planner
- WBC Sandbox
- WBC Regression
- WBC Recovery

## Logistics capability families

The logistics surface must recover and preserve distinct capability contracts for:

1. Trucking and fleet command
2. Driveaway operations
3. Aviation control
4. Aquatic operations
5. EMS and emergency operations
6. Personnel, HR and modular training
7. Dispatch, routing and trip execution
8. Asset maintenance and inspections
9. Safety, security and incident response
10. Compliance and governance
11. Billing, settlements, costs and exceptions
12. Documents, evidence and audit
13. Integrations and provider health
14. Net Zero and climate operations
15. Agent Hub, White Blood Cells and governed repair

These are operational products, not labels on one generic table page.

## Shared runtime requirements

All delivery surfaces must:

- use the same organization and system identifiers;
- use the same Analyst Memory and active canonical-memory rules;
- enforce `agent_capability_is_active(...)` before agent action;
- default deny ungranted capabilities;
- preserve cost, step, runtime, memory-scope and egress limits;
- require human approval for destructive, external, credential, deployment, financial, authorization, medium-risk and high-risk actions;
- distinguish `NOT_IMPLEMENTED`, `BLOCKED`, `FAILED`, `EXECUTED` and `VERIFIED`;
- never infer business success from an HTTP 200, empty queue, Vercel READY state or page render;
- create source, execution, output, validation, audit and failure-recovery evidence;
- use active, reviewed canonical memory only.

## Configuration names

Frontend clients use only publishable credentials:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Server-side systems may use separate scoped secrets, but service-role, provider and GitHub credentials must never appear in client bundles, source control, chat transcripts, Analyst Memory bodies or ordinary logs.

GitHub execution must use a least-privilege installation credential with repository allow-listing and short-lived tokens. Replit and Base44 must receive only the scopes required for their assigned role.

## Release state at creation

- PR #31 merged to main: `80dd304160d96ac6d628b65a8af7930046fe34a7`
- GitHub Quality Gate: run `32900450854` — success
- Vercel production deployment: `dpl_9hth29V3nY6WuWNbppYimeaHjALN` — READY
- THELMA Edge Function: `thelma-ai` v2 — ACTIVE, JWT required
- Replit logistics app: `410249c4-3049-4f7c-b127-db924ec64189` — provisioning
- Base44: blocked by OAuth reauthentication before app inventory
- Authenticated THELMA conversation certification: blocked pending authorized CEO sign-in
- Current observed ledger: 61 active White Blood Cell signals, 0 conversations, 0 messages, 0 repair plans

## Certification gates

THELMA is contact-ready only when an authenticated CEO instruction:

1. reaches `thelma-ai`;
2. passes organization membership and capability authorization;
3. creates conversation and message records;
4. returns a real model response with provider/model evidence;
5. reads Analyst Memory and active White Blood Cell signals;
6. generates the dependency-ordered repair queue;
7. creates tool/security/audit evidence;
8. renders the response in the production UI;
9. leaves no unexplained runtime error.

Logistics is production-ready only after every primary workflow passes the full reconstruction gate:

`SOURCE -> CONTRACT -> IMPLEMENTATION -> AUTHORIZATION -> EXECUTION -> OUTPUT -> VALIDATION -> AUDIT -> FAILURE RECOVERY -> TEST -> RELEASE EVIDENCE`
