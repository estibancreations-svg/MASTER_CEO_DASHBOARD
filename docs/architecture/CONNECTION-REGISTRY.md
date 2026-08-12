# CEO Dashboard Connection Registry

The CEO Dashboard consumes normalized read models and governed actions. It does not absorb the identity or business logic of connected systems.

| Connection | Owner | Contract | Current state | Executive use |
|---|---|---|---|---|
| Supabase Master Dashboard | SYS-CEO-001 control plane | Database, Auth, Realtime, Edge Function | Connected | Executive status, integrations, decisions and audit |
| T.H.E.L.M.A. | SYS-THELMA-001 | Governed command/orchestration | Planned | Briefings, dispatch, escalation and work queues |
| VisionWeaver | SYS-VISION-001 | Read model plus governed command | Degraded / hardening | Projects, scenes, renders, QC and distribution |
| Google Drive | SYS-CEO-001 evidence layer | OAuth evidence/document access | Connected | Source evidence, documents and briefings |
| n8n Air Gap | SYS-THELMA-001 | Signed webhook/workflow | Planned | Mediated cross-system automation |
| CMGIO / MAP | SYS-ADS-001 | Read model plus approval | Planned | Growth, campaigns and creative outputs |
| LandWeaver | SYS-LAND-001 | Executive read model | Planned | Property pipeline, diligence and risk |
| GrantOS | SYS-GRANT-001 | Executive read model | Planned | Opportunities, deadlines, awards and compliance |

## Runtime configuration

- Browser code receives only `VITE_SUPABASE_URL` and a Supabase publishable key.
- Service-role and provider credentials remain server-side.
- CEO data requires authenticated users with `app_metadata.role` equal to `ceo` or `architect`.
- Material actions require an audit event and explicit authority.
- Missing integrations degrade independently and must not take down the command shell.
