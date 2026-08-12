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
