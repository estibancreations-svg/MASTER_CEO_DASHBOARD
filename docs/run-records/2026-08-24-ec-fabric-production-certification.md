# EC Integration Fabric — Production Certification

Date: 2026-08-24

## Production result

n8n is retired as a required production dependency. Supabase is the EC Integration Fabric control plane; Vercel remains the application delivery layer.

## Completed production changes

- Enabled Supabase PGMQ durable queues: `ec_orchestration`, `ec_vision`, `ec_agents`, `ec_connectors`, `ec_qc`, `ec_monitoring`, `ec_dead_letter`.
- Added authorized-job queue routing and idempotent enqueue protection.
- Added governed queue consumer with state transitions: queued → claimed → running → completed.
- Added bounded retry/dead-letter handling and immutable execution events.
- Added `ec_fabric_health` operational health view.
- Scheduled six EC Fabric consumers with `pg_cron` every minute.
- Preserved VisionWeaver's existing durable production orchestrator and Runway credential name `RUNWAY_API_ACCESS`.

## Certification evidence

- Success-path job completed through the production monitoring queue.
- Controlled failure was correctly moved to `ec_dead_letters`; the synthetic incident was then resolved and cancelled.
- Post-test Fabric health: zero queued, running, retrying, or open dead-letter jobs.
- Six worker schedules confirmed active.
- Vercel production runtime had no runtime errors in the 24-hour check performed during certification.

## Security/QC observations

Supabase security advisor reported no critical EC Fabric findings. Account-level leaked-password protection remains a recommended Auth setting. Recovery-schema RLS-without-policy notices are informational because those recovery tables are intentionally not exposed to normal authenticated application traffic.

## Architecture lock

Vercel → Dashboard/UI delivery

Supabase → Auth + Postgres + PGMQ + pg_cron + EC Fabric state/audit

EC Integration Fabric → owned orchestration, authorization, retries, dead letters, monitoring, worker routing

VisionWeaver / THELMA / agents / connectors / QC → queue consumers and downstream systems

n8n → optional migration/adapter only; not required for production.