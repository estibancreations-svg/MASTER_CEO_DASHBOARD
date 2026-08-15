# Edge Function boundary hardening run record

**Date:** 2026-08-15  
**Supabase project:** `yqealeekngxooyoemfba`

## Deployed versions

| Function | Version | JWT mode | Boundary |
|---|---:|---:|---|
| `dashboard-data` | 2 | Required | JWT + user lookup + CEO/Architect app-metadata role |
| `visionweaver-orchestrator` | 8 | Custom | Vault bearer secret + constant-time comparison + method restriction |
| `oauth-callback` | 3 | Custom | Expiring single-use OAuth state + atomic claim + PKCE |

## Changes

- Removed the fixed VisionWeaver secret digest from source.
- VisionWeaver now resolves `VISIONWEAVER_CRON_SECRET` from Vault at invocation time.
- Restricted VisionWeaver execution to POST and its health route to signed GET.
- Repaired and hardened the OAuth callback source.
- Prevented OAuth state replay by consuming state before external token exchange.
- Required both OAuth client ID and client secret for configured social providers.
- Stopped returning provider error details to the browser.
- Fails closed when Vault token storage or the social-connection write fails.
- Added authoritative per-function JWT configuration to source control.
- Added the previously deployed `dashboard-data` and VisionWeaver function sources to the repository.

## Verification

- Supabase accepted both function deployments as ACTIVE.
- The VisionWeaver cron job remains active, runs every minute, uses POST, resolves the named secret from Vault, and sends an Authorization header.
- Unsigned request tests and post-deployment cron evidence are recorded in the final batch verification.
- Provider generation remains disabled because provider credentials are still placeholders.
