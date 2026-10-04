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


## VisionWeaver character identity boards

The CEO Dashboard treats character references as governed production records shared with VisionWeaver. The approved hierarchy is:

1. **A Cast Board** — multi-character scene fallout and active scene cast.
2. **Character Detail Specifications Board** — canonical physical, texture, wardrobe, injury, voice, and identity anchors.
3. **360 View Board** — individual character generation and camera reference.

The default 360 View Board is a **32-view master**: eight eye-level azimuth views, eight high-oblique views, eight low-oblique views, and eight extreme-oblique views. A **16-view state board** is the controlled variant for clothing-only or limited non-identity changes. Each active scene state is versioned and referenced by the Cast Board. This supports carousel exports and prevents identity drift across Runway, VisionWeaver, and dashboard workflows.

Canonical implementation contract: [VisionWeaver Character Identity Board System](https://github.com/estibancreations-svg/VisionWeaver/blob/main/standards/character-board-system-v1.md).

## Representation and historical locations

The authorized [Representation and Place-Time Standard v1](docs/architecture/REPRESENTATION-AND-PLACE-TIME-STANDARD-v1.md) governs new character defaults: intentional inclusive casting, normal representation of Black and fat people, preservation of approved appearance, and evidence-backed scene location/date accuracy. The current balloon-film boy is Black and fat. Runtime enforcement and end-to-end verification remain open release gates.

## Avatar State and animation production — October 3, 2026

The [repository integration contract](docs/architecture/VISIONWEAVER-AVATAR-STATE-ANIMATION-INTEGRATION.md) links Avatar State v1.1 and children's animation/teaching v1.0: three boards, reconciled coverage, actual avatar references, scoped changes, perception/contact/reaction timing, world/camera anchors, vehicle/enclosure continuity and evidence-based acceptance. Documentation is synchronized; camera calibration and runtime/production verification remain open.


## VisionWeaver global reference catalog — October 4, 2026

The [VisionWeaver Global Reference Catalog integration](docs/architecture/VISIONWEAVER-GLOBAL-REFERENCE-CATALOG.md) adds governance for worldwide place, people, environment and travel-reference sourcing. The dashboard tracks provider terms, rights classes, provenance completeness, stale-policy reviews, identifiable-person/minor flags, geographic coverage, Location Pack approval and blocked ingestion attempts.

Canonical detail remains in Design Studio and VisionWeaver. Documentation does not certify runtime provider ingestion or permissions.
