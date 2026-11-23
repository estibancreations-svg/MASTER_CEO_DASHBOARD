# Render migration mapping

Decision recorded November 22, 2026 (America/Chicago).

| Item | Mapping |
| --- | --- |
| Repository | `MASTER_CEO_DASHBOARD` |
| Reviewed source | [`5a5d039fb841`](https://github.com/estibancreations-svg/MASTER_CEO_DASHBOARD/commit/5a5d039fb84107db2ecda56489d8193f13cde785) |
| Placement | Wave 1 · first cutover |
| Repository action | Render Node web service for React/Vite and same-origin VisionWeaver continuity/assembly routes. Keep the existing Supabase database, Auth and Storage. Match the deployed project binding before changing redirects. Pilot GrantOS research and app workflows independently. |
| Hosting decision | Render is the application host for approved runtimes. |
| Data and identity | Retain each existing Supabase binding for Postgres, Auth and Storage where applicable. Preserve each system's access and data boundary. |

## Release evidence

The verified sample contains 27 failed Vercel preview checks across nine GrantOS commit SHAs (three linked projects per SHA), one intervening commit with three successful previews, and a separately observed production availability block. These checks show two documented failure episodes around a temporary recovery. The sample establishes a lower bound on checks, with no claim about total historical incidents.

The [enterprise decision and forensic evidence](https://github.com/estibancreations-svg/Master-System-Buildout/blob/docs/render-migration-2026-11-22/docs/forensics/2026-11-22-render-migration.md) records the exact SHAs, preview results, production effect, migration waves and rollback gate. [GrantOS PR #66](https://github.com/estibancreations-svg/MASTER_CEO_DASHBOARD/pull/66) separately records invariant test failures and uncertified production status.

## Cutover criteria

For a confirmed hosted application, record the Render service, source SHA, build and health checks, data binding, access tests, verified target domain and rollback procedure. Promote after applicable GitHub Quality Gates and runtime checks pass on the exact candidate. Documentation-only repositories carry the mapping in GitHub.
