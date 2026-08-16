# MASTER_CEO_DASHBOARD

Governed Estiban Creations executive command shell and attached-system workspace.

## Architecture authority

- Schema: `MSB-SCHEMA-001`
- Local implementation: [Enterprise Build Specification](docs/architecture/MASTER-CEO-DASHBOARD-ENTERPRISE-BUILD-SPECIFICATION.md)
- Schema checkpoint: [System Build Schema Reference](docs/architecture/SYSTEM-BUILD-SCHEMA-REFERENCE.md)
- Canonical standard: `estibancreations-svg/Master-System-Buildout/01-ARCHITECTURE/System-Build-Schema/SYSTEM-BUILD-SCHEMA-STANDARD-v1.0.md`

## Current operational truth

The application is deployed as a responsive builder release.

- 25 governed dashboard modules are present.
- VisionWeaver, LandWeaver, GrantOS, THELMA, CMGIO/MAP and EC Integration Fabric open as attached workspaces.
- Provider-independent workflows are internally certified.
- Builder mode intentionally bypasses login and uses clearly labeled seeded interface records.
- Protected browser writes and external provider execution remain disabled.
- Authentication is launch-configurable and ready for its test matrix.
- Provider and partner Vault slots are prepared; credentials are installed later and certified one connector at a time.
- Recovery policies, evidence ledgers and guarded local backup/restore scripts are present.
- The release is not production-certified until the remaining external gates in [QC-GATE.md](docs/QC-GATE.md) pass.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Browser-safe configuration:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
VITE_BUILDER_MODE=true
```

Never place service-role keys, database passwords or provider credentials in `VITE_` variables.

Set `VITE_BUILDER_MODE=false` only after organization membership, role, denied, expired-session and sign-out tests pass.

## Validate

```bash
npm run lint
npm run build
```

## Operations

- [Connection Registry](docs/architecture/CONNECTION-REGISTRY.md)
- [Provider Key Installation Matrix](docs/provider-activation/KEY-INSTALLATION-MATRIX.md)
- [Backup and Restore Runbook](docs/operations/BACKUP-RESTORE-RUNBOOK.md)
- [Physical Device Sign-off](docs/operations/PHYSICAL-DEVICE-SIGNOFF.md)
- [Quality Gate](docs/QC-GATE.md)

## Attached systems

- **VisionWeaver (`SYS-VISION-001`)** — durable production, scenes, rendering state, QC and provenance.
- **LandWeaver (`SYS-LAND-001`)** — governed property intake, assessment, diligence, financial review and approval.
- **GrantOS (`SYS-GRANT-001`)** — opportunities, evidence requirements, budgets and application workflow.
- **THELMA (`SYS-THELMA-001`)** — requests, authorization, commands, runs, incidents and resolution.
- **CMGIO/MAP (`SYS-ADS-001`)** — campaigns, assets, signals, authorization and optimization.
- **EC Integration Fabric** — owned connectors, queues, workflows, retries, dead letters and audit; n8n is optional.
