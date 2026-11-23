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

## Migration verification · 2026-11-22T21:35:36-06:00

**Staging smoke checks passed.** The [Render staging deploy](https://dashboard.render.com/web/srv-dc1qj3mc6qcc73bives0/deploys/dep-dc1qj46c6qcc73bivg30) is live on `a70a292a98e67d64ed576a96617c45394fd2adec`. [Staging](https://master-ceo-dashboard-staging.onrender.com) returned 200 for health, dashboard, GrantOS and VisionWeaver routes. Both FFmpeg APIs returned 200 and reported binary readiness. Unauthenticated POSTs returned 401. A local synthetic FFmpeg concat and frame extraction succeeded. The exact-commit [GitHub Quality Gate](https://github.com/estibancreations-svg/MASTER_CEO_DASHBOARD/actions/runs/45102714566) failed on three existing VisionWeaver invariants (44/47). Supabase project `Master Dashboard` matched the architecture record and all five checked GrantOS/Video tables. Auth redirect, signed-in workflow, live media jobs and production promotion are pending. [Implementation PR #68](https://github.com/estibancreations-svg/MASTER_CEO_DASHBOARD/pull/68).

[Enterprise verification record](https://github.com/estibancreations-svg/Master-System-Buildout/blob/docs/render-migration-2026-11-22/docs/forensics/2026-11-22-render-migration.md)

## Supabase Auth callback · 2026-11-22T22:55:31-06:00

Saved and verified the exact staging redirect `https://master-ceo-dashboard-staging.onrender.com/dashboard` in the existing Master Dashboard project. The existing Site URL and redirect entry were retained. Render returned HTTP 200 for the dashboard callback, and its health check returned `ok: true`. End-to-end application sign-in and the existing release gate remain pending.
