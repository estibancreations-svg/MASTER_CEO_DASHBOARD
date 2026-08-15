# CEO Dashboard Connection Registry

The CEO Dashboard consumes normalized read models and governed actions. It does not absorb the identity or business logic of connected systems.

| Connection | Owner | Current state | Current operational truth |
|---|---|---|---|
| Supabase Master Dashboard | SYS-CEO-001 | Connected foundation | Database, RLS, Auth configuration, Realtime tables and three Edge Functions exist. Builder mode currently avoids protected writes. |
| Vercel | SYS-CEO-001 | Production connected | Production deployment is READY and the canonical URL responds successfully. |
| GitHub | SYS-CEO-001 | Source/deployment connected | Private repository main drives Vercel deployments; work is merged through PR #17 before this QC branch. |
| THELMA | SYS-THELMA-001 | Control plane built; intelligence deferred | ASK intake, agents, commands, runs, incidents and audit structures exist. No OpenAI, Gemini, Grok or DeepSeek provider is active. |
| EC Integration Fabric | SYS-THELMA-001 | Internal foundation built | Eight connectors, six workflow definitions and 25 bindings exist. No production integration jobs have executed yet. |
| VisionWeaver | SYS-VISION-001 | MVP / provider-gated | Console, schema and orchestrator exist. Live AI/video providers and an end-to-end production run remain deferred. |
| LandWeaver | SYS-LAND-001 | MVP / synthetic data | Fifteen markets, twelve provider definitions and fifteen demonstration properties exist. Licensed live feeds remain deferred. |
| GrantOS | SYS-GRANT-001 | MVP / seeded data | Funding schema, three opportunities/applications and fifteen requirements exist. Live discovery and submission providers remain deferred. |
| CMGIO / MAP | SYS-ADS-001 | MVP / manual pilot | Campaign and signal structures exist. Social, advertising, analytics and publishing providers remain deferred. |
| Google Drive | SYS-CEO-001 evidence layer | Registered; runtime deferred | Source files exist in Drive, but the deployed application does not yet call a governed Drive evidence service. |
| Base44 | External build surface | Deferred | No required runtime dependency. |
| Canva / Ads / Email | External providers | Staged or deferred | Credentials and live calls are postponed to the consolidated provider activation pass. |
| n8n | Former workflow option | Not required | Paid dependency was replaced by the owned EC Integration Fabric. |

## Runtime rules

- Browser code receives only VITE_SUPABASE_URL and a Supabase publishable key.
- Provider secrets and privileged database credentials remain server-side.
- Full launch requires authenticated organization membership and role enforcement.
- Material actions require explicit authority, correlation and an audit event.
- Missing integrations degrade independently and must not take down the command shell.
- A connector cannot be labeled production until a traced end-to-end transaction and rollback test pass.
