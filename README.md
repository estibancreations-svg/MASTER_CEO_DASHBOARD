# MASTER_CEO_DASHBOARD

## Architecture Authority

This system is governed by the Master Systems Buildout schema:

- Schema ID: `MSB-SCHEMA-001`
- Local reference: [`docs/architecture/SYSTEM-BUILD-SCHEMA-REFERENCE.md`](docs/architecture/SYSTEM-BUILD-SCHEMA-REFERENCE.md)
- Canonical standard: `estibancreations-svg/Master-System-Buildout/01-ARCHITECTURE/System-Build-Schema/SYSTEM-BUILD-SCHEMA-STANDARD-v1.0.md`

Agents and developers must retrieve the canonical standard before creating or revising system specifications. The CEO Dashboard build must also cross-reference the C-Suite System of Record and CEO AI Executive Office definition.

## Connected MVP

The repository now contains the runnable CEO Command Center application with all 17 governed executive surfaces, responsive layouts, Supabase authentication, realtime executive read models, integration status, and explicit source-system authority boundaries.

### Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the deployment environment. Never place service-role or provider credentials in browser variables.

### Validate

```bash
npm run lint
npm run build
```

See [`docs/architecture/CONNECTION-REGISTRY.md`](docs/architecture/CONNECTION-REGISTRY.md) and [`docs/QC-GATE.md`](docs/QC-GATE.md).

## Attached systems

- **LandWeaver (`SYS-LAND-001`)** — The Property Intelligence surface now opens the connected 15-view acquisition workspace backed by Supabase. It supports governed property intake, evidence classification, hazard/utility/zoning/financial/comparable assessment records, diligence tasks, executive decisions, realtime updates, provenance and explicit professional-certification boundaries.
  - Southeast launch bundle: Tampa, Orlando, Plantation, Sanford; Atlanta, Decatur, Augusta, Savannah, Norcross; Mobile, Gulf Shores, Orange Beach, Foley, Daphne and Fairhope.
  - The API Settings view separates public, manual, credentialed and licensed sources. Demonstration properties are synthetic and cannot be mistaken for verified records.

## Alignment checkpoint — 2026-08-12

**Timestamp:** `2026-08-12T15:13:35-04:00`

- Design/specification PR #1 merged to `main` as `d7502147`.
- Connected MVP/LandWeaver PR #2 merged to `main` as `bd597b03`.
- Canonical governance and migration record: [Master-System-Buildout closeout](https://github.com/estibancreations-svg/Master-System-Buildout/blob/main/07-DOCUMENTATION/Status-Reports/2026-08-12_REPOSITORY-MIGRATION-PR-AND-SYSTEM-ALIGNMENT-CLOSEOUT.md).
- CEO Dashboard and LandWeaver retain separate System IDs and authority boundaries even though the LandWeaver workspace is attached here.
- The Vercel deployment error remains deferred for review; merge completion does not certify a successful production deployment.
