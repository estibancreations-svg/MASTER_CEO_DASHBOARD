# THELMA Alerts, Ecosystem Intelligence, and Plugin Architecture

**Status:** Implemented control plane / provider activation tracked separately  
**Owner:** CEO + THELMA  
**Effective:** 2026-08-25

## Canonical behavior

THELMA detects, explains, prioritizes, and alerts. She may automatically perform approved read-only diagnosis and evidence collection. When a proposed action crosses a permission boundary, she creates an approval request and pauses. The CEO approves or rejects the bounded action; approval is recorded in the security ledger.

The Ecosystem Scout runs weekly and may search, collect metadata, compare, score, and recommend. It may not install code, grant permissions, merge changes, deploy, or change production. “Approve evaluation” means sandbox evaluation only. Production adoption requires a later, separate gate.

## Live control-plane components

- `thelma_alerts`: executive alert stream from White Blood Cells, repair plans, and ecosystem advisements.
- `thelma_approval_requests`: explicit human decisions with risk, tool, payload, approver, time, and evidence.
- `ecosystem_watch_sources`: versioned query families mapped to canonical systems.
- `ecosystem_scan_runs`: weekly/manual scan receipts and failures.
- `ecosystem_candidates`: repository usage, maintenance, license, and health signals with a scored breakdown.
- `ecosystem_advisements`: ADOPT / ADAPT / REFERENCE / REJECT / FUTURE recommendations.
- `thelma_plugin_registry`: connection truth for models, MCP servers, app plugins, and specialist executors.
- `ECOSYSTEM_SCOUT`: bounded read/score/advise specialist under THELMA.

## Connection types are not interchangeable

| Type | Example | What it means |
|---|---|---|
| Model API | OpenAI Responses API, Anthropic Messages API | THELMA can ask a model to reason or generate content. |
| Agent runtime | OpenAI Agents SDK, Claude Agent SDK | A server runs multi-step agent loops, tools, state, guardrails, and approvals. |
| Coding specialist | Codex SDK / Codex MCP server, Claude Code | A sandboxed worker can inspect repositories, patch code, and run tests. |
| MCP connector | Figma, GitHub, Google Drive | A standard tool interface exposes selected service operations to an agent. |
| ChatGPT plugin | Figma or another plugin connected in ChatGPT | Available to the user in ChatGPT. It is not automatically a credential or tool inside THELMA. |

## Current provider state

| Integration | Current state | Next activation gate |
|---|---|---|
| OpenAI models | `MODEL_ACTIVE` | Keep model routing and spend policy current. |
| Claude models | `MODEL_ACTIVE` | Keep model routing and spend policy current. |
| Codex engineering specialist | `PLANNED` | Deploy a sandboxed server-side Codex SDK/MCP worker with a scoped GitHub App. |
| Figma | `CHATGPT_ONLY` | Use Figma through an officially supported Codex/Claude client first; direct custom THELMA client support requires Figma approval/support or an alternate official API path. |
| GitHub repair executor | `AWAITING_CREDENTIAL` | Create a least-privilege GitHub App; never use a broad personal token. |
| Supabase | `ACTIVE` | Continue RLS, service-role isolation, and evidence logging. |
| Vercel | `PLANNED` | Add scoped read/verification access; production remains Git + Quality Gate governed. |
| Replit logistics | `PLANNED` | Complete authenticated Supabase logistics E2E certification. |
| Base44 | `DEFERRED` | Not on the critical path. |

## Standard plugin onboarding

1. Register the proposed integration in `thelma_plugin_registry` as `PLANNED` or `AWAITING_OAUTH`.
2. Define the exact read tools, write tools, data scopes, egress domains, cost ceiling, and owner agent.
3. Use OAuth or a workload identity where available. Store secrets only in the governed secret store/runtime environment, never in browser code or ordinary tables.
4. Allowlist tools. Read-only operations may be low-risk autonomous; external writes require approval by default.
5. Put coding, shell, file, browser, or untrusted-code work in an isolated sandbox.
6. Log every tool request, approval, result, provider receipt, cost, and failure.
7. Run prompt-injection, confused-deputy, exfiltration, permission, cost, rollback, and regression tests.
8. Activate only the capabilities that passed; keep unused provider tools disabled.
9. Monitor provider/MCP tool definitions and behavior for drift. A plugin update does not auto-expand permission.

## OpenAI and Codex inside THELMA

Use the OpenAI Agents SDK for THELMA’s multi-agent loop, handoffs, guardrails, tracing, and resumable approval state. Use the Codex SDK or Codex as an MCP specialist for coding work. Codex runs server-side against a sandbox and a scoped GitHub App, produces a branch/PR, and cannot merge or deploy until the Quality Gate and CEO policy permit it.

Official references:

- [OpenAI Agents SDK](https://developers.openai.com/api/docs/guides/agents)
- [OpenAI MCP and connectors](https://developers.openai.com/api/docs/guides/tools-connectors-mcp)
- [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk)

## Claude inside THELMA

Claude can remain a model route through the Messages API or become a specialist worker through the Claude Agent SDK. Claude’s MCP connector can connect remote HTTP MCP servers and allowlist individual tools. THELMA still owns approval, memory, cost, and evidence policy; provider-specific agents do not receive blanket authority.

- [Claude MCP connector](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector)
- [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview)

## Figma inside THELMA

Figma’s remote MCP endpoint is `https://mcp.figma.com/mcp`. Figma recommends the remote server and supports design context plus canvas writes in approved clients. The immediate safe architecture is:

`THELMA -> approved design mission -> Codex/Claude design specialist -> Figma MCP -> preview/evidence -> CEO approval -> implementation PR`

The Figma connection currently available in ChatGPT is account-scoped to ChatGPT and does not automatically transfer into the Supabase Edge Function. The direct custom-client path must follow Figma’s supported-client rules.

- [Figma remote MCP setup](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/)
- [Figma MCP overview](https://developers.figma.com/docs/figma-mcp-server/)

## Weekly operating review

The scheduled scan runs Monday at 13:00 UTC. THELMA presents:

- what changed;
- source and provenance;
- stars/forks as usage context;
- maintenance recency;
- license status;
- security/test/documentation evidence when available;
- which Estiban capability could improve;
- recommendation and cost/risk implications;
- a separate CEO decision for sandbox evaluation.

No popularity metric alone certifies quality. No weekly discovery can auto-promote into production.

