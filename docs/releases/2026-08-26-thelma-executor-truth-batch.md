# Release Evidence — THELMA Executor + Truth Controls

Release state: `NOT PRODUCTION-CERTIFIED`

Scope:

- THELMA approval-linked Codex repair executor control plane
- Repairs 11–15: provider drift, ownership lineage, business observability, capability-weighted certification, and reconstruction gates

Verified before merge:

- Supabase migrations applied atomically
- approval synchronization rollback tests passed
- RLS and explicit grants verified
- Supabase security/performance advisors returned no findings for new tables
- policy invariants passed locally

Required after merge:

- GitHub Quality Gate on the complete release head
- Vercel production deployment `READY`
- dedicated `OPENAI_API_KEY` GitHub Actions secret installed
- one low-risk approved Codex repair dry run
- PR, deployment, and VERITAS receipts written back to the Analyst Bank

