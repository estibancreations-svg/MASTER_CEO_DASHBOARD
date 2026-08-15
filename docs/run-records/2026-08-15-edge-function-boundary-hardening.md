# Edge Function boundary hardening run record

**Date:** 2026-08-15  
**Supabase project:** `yqealeekngxooyoemfba`

## Deployed versions

| Function | Version | JWT mode | Boundary |
|---|---:|---:|---|
| `dashboard-data` | 3 | Required | JWT + user lookup + CEO/Architect app-metadata role |
| `visionweaver-orchestrator` | 9 | Custom | Vault bearer secret + constant-time comparison + method restriction |
| `oauth-callback` | 4 | Custom | Expiring single-use OAuth state + atomic claim + PKCE |

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
- Corrected the dashboard CORS default to `https://master-ceo-dashboard.vercel.app`.
- Added dual support for current publishable/secret-key environment variables with a safe legacy-key fallback.

## Verification

- Supabase accepted both function deployments as ACTIVE.
- The VisionWeaver cron job remains active, runs every minute, uses POST, resolves the named secret from Vault, and sends an Authorization header.
- Unsigned VisionWeaver health request returned HTTP 401.
- OAuth callback without valid parameters returned HTTP 400.
- Dashboard read request without a JWT returned HTTP 401 at the platform boundary.
- Post-deployment VisionWeaver cron HTTP responses returned 200 with no timeouts.
- Provider generation remains disabled because provider credentials are still placeholders.
