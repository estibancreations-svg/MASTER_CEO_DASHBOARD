# Provider and partner registry expansion run record

**Date:** 2026-08-15  
**Supabase project:** `yqealeekngxooyoemfba`  
**Organization:** `20e10428-4443-4324-b36a-e68d64ec26ed`

## Outcome

- Added 19 governed EC connector records.
- Added 10 staged direct service/provider connections.
- Added 2 optional/deferred self-hosted orchestration connections.
- Added 4 partner-access-required insurer records.
- Added 3 reusable blank connection templates.
- Created 25 new Vault placeholder names and reused the existing `ANTHROPIC_API_KEY` slot, for 26 expected slots total.
- Added no raw credential values to public tables or source control.
- Kept all new connectors non-production: 10 staged, 9 deferred, 0 configured/healthy.

## Verification

| Check | Result |
|---|---:|
| Expected connector records | 19 / 19 |
| Blank templates | 3 / 3 |
| Partner-access-required records | 4 / 4 |
| Vault slots inspected by name/status | 26 / 26 |
| Placeholder slots | 26 |
| Non-placeholder slots | 0 |
| Newly labeled configured/healthy | 0 |

Supabase security advisor reported no new schema security finding. The project retains the pre-existing warning that leaked-password protection is disabled. Performance advisors contain pre-existing informational and policy/index recommendations outside this batch.

## Boundaries

- OpenAI and OpenRouter remain separate connections.
- “King” was interpreted as Kling AI.
- Claude uses `ANTHROPIC_API_KEY`.
- Paperclip and n8n are optional; the EC Integration Fabric remains the workflow authority.
- Insurance and fuel-company records are partner templates and do not assert public API availability.
- Activation requires credential replacement, health checks, least privilege, cost controls, audit evidence and a kill switch.
