# Execution Truth Controls — Repairs 11–15

Effective 2026-08-26, five permanent ledgers replace informal assumptions:

1. `provider_drift_registry` and `provider_drift_events` track model IDs, lifecycle, pricing, authentication, verification dates, and drift evidence. Past-deprecation models are removed from active routing.
2. `enterprise_account_registry` records business, technical, billing, and recovery ownership for every critical account without storing credentials.
3. `business_workflow_contracts` defines health by completed user outcomes and evidence—not HTTP 200, deployment READY, or an empty queue.
4. `capability_certification_snapshots` calculates separate specification, implementation, integration, test, security, operational, and certification scores against the actual capability denominator.
5. `reconstruction_gate_evidence` requires all eleven links: SOURCE → CONTRACT → IMPLEMENTATION → AUTHORIZATION → EXECUTION → OUTPUT → VALIDATION → AUDIT → FAILURE RECOVERY → TEST → RELEASE EVIDENCE.

The previous `ceo_system_status.progress_percent` values are retained only inside provenance as retired legacy claims. Current percentages are recalculated from certified capabilities. With 168 requirements still `UNMAPPED`, zero is the truthful certification score—not 82–100%.

These control planes do not themselves certify production. They make missing evidence visible and prevent deployment state from masquerading as business readiness.

