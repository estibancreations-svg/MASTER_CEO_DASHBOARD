# CEO Dashboard Connection Registry

The CEO Dashboard consumes normalized read models and governed actions. It does not absorb the identity or business logic of connected systems.

| Connection | Owner | Current state | Current operational truth |
|---|---|---|---|
| Supabase Master Dashboard | SYS-CEO-001 | Connected foundation | Database, RLS, Auth configuration, Realtime tables and Edge Functions exist. Builder mode currently avoids protected browser writes. |
| Vercel | SYS-CEO-001 | Production connected | Production deployment is READY and the canonical URL responds successfully. |
| GitHub | SYS-CEO-001 | Source/deployment connected | Private repository main drives Vercel deployments; work is merged through PR #20 before the runtime-hardening branch. |
| THELMA | SYS-THELMA-001 | Control plane internally certified; intelligence deferred | ASK intake, authorization, commands, runs, incidents, containment and audit structures passed rollback-safe testing. No OpenAI, Gemini, Grok or DeepSeek provider is active. |
| EC Integration Fabric | SYS-THELMA-001 | Internal runtime certified | Job creation, authorization, claim, execution, retry, dead letter, human requeue, event history and immutable audit boundaries passed. External connectors remain provider-gated. |
| VisionWeaver | SYS-VISION-001 | Internal workflow certified / provider-gated | Project, scene, approval, render-state, QC and completion structures passed rollback-safe testing. Live AI/video providers remain deferred. |
| LandWeaver | SYS-LAND-001 | Internal workflow certified / synthetic data | Intake, assessment, financial scenario, diligence task and approval paths passed. Licensed live feeds remain deferred. |
| GrantOS | SYS-GRANT-001 | Internal workflow certified / seeded data | Opportunity, application, evidence requirement, budget and drafting-state paths passed. Live discovery and submission providers remain deferred. |
| CMGIO / MAP | SYS-ADS-001 | Internal workflow certified / manual pilot | Campaign, asset QC, signal action, authorization and completion paths passed. Social, advertising, analytics and publishing providers remain deferred. |
| Google Drive | SYS-CEO-001 evidence layer | Registered; runtime deferred | Source files exist in Drive, but the deployed application does not yet call a governed Drive evidence service. |
| Base44 | External build surface | Deferred | No required runtime dependency. |
| Canva / Ads / Email | External providers | Staged or deferred | Credentials and live calls are postponed to the consolidated provider activation pass. |
| n8n | Former workflow option | Not required | Paid dependency was replaced by the owned EC Integration Fabric. |

## Runtime rules

- Browser code receives only VITE_SUPABASE_URL and a Supabase publishable key.
- Provider secrets and privileged database credentials remain server-side.
- Full launch requires authenticated organization membership and role enforcement.
- Material actions require explicit authority, correlation and append-only audit evidence.
- EC Fabric transitions are enforced in PostgreSQL; invalid jumps and silent retry resets are rejected.
- Missing integrations degrade independently and must not take down the command shell.
- A connector cannot be labeled production until a traced end-to-end provider transaction and rollback test pass.


## Provider and partner registry expansion — 2026-08-15

The EC connector registry now contains 19 additional governed entries:

- 10 staged connections: OpenAI, Grok/xAI, DeepSeek, Claude/Anthropic, Kling AI, Slack, Honcho, Telegram, ElevenLabs and Higgsfield AI.
- 2 optional/deferred self-hosted connections: Paperclip and n8n.
- 4 partner-access-required insurer templates: Allstate, The General, Progressive and State Farm.
- 3 reusable blank templates: insurance provider, gas station/fuel provider and general external service.

Credential metadata stores secret **names only**. Secret values remain in Supabase Vault. No new entry is labeled connected or production. The insurer entries do not claim that a public API exists; activation requires approved partner credentials and terms. n8n remains an optional bridge or migration adapter, and the owned EC Integration Fabric remains the primary workflow authority.
