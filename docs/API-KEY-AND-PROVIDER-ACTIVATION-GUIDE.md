# API Key and Provider Activation Guide

**System:** Estiban Creations Master CEO Dashboard  
**Date:** 2026-08-15  
**Rule:** Never paste secrets into ChatGPT, GitHub, frontend variables, screenshots, tickets, or committed files.

## Current inventory

The live project was inspected by secret name and status only. No secret values were read or recorded.

| Credential slot | Current status | Runtime consumer | Purpose |
|---|---:|---|---|
| `VISIONWEAVER_CRON_SECRET` | SET | VisionWeaver scheduler boundary | Authorizes the internal scheduled invocation |
| `RUNWAY_API_KEY` | PLACEHOLDER | VisionWeaver orchestrator | Submit and poll video-generation jobs |
| `ANTHROPIC_API_KEY` | PLACEHOLDER | VisionWeaver orchestrator | Parse concepts, create scene breakdowns, prompts, and publish packages |
| `GEMINI_API_KEY` | PLACEHOLDER | Provider health registry; routing integration pending | Gemini text/image capability |
| `KIE_API_KEY` | PLACEHOLDER | Provider health registry; adapter integration pending | KIE-hosted image, video, and audio models |
| `OPENROUTER_API_KEY` | PLACEHOLDER | Provider health registry; THELMA routing integration pending | Multi-model routing and controlled fallback |

## Where each class of value belongs

### 1. Supabase Vault — model and media provider keys

Use the Supabase project **yqealeekngxooyoemfba** and open **Database → Vault**. Replace the placeholder value for the exact existing secret name. Do not create spelling variants.

Put these in Vault:

- `RUNWAY_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `KIE_API_KEY`
- `OPENROUTER_API_KEY`

The current VisionWeaver orchestrator calls the database `get_secret` function, so putting Runway or Anthropic only in Vercel or Edge Function Secrets will not activate that pipeline.

### 2. Supabase Edge Function Secrets — OAuth application credentials

Use **Edge Functions → Secrets** for credentials read with `Deno.env.get(...)`.

Create these only when their developer applications and callback URLs are ready:

- `TIKTOK_CLIENT_ID` and `TIKTOK_CLIENT_SECRET`
- `PINTEREST_CLIENT_ID` and `PINTEREST_CLIENT_SECRET`
- `THREADS_CLIENT_ID` and `THREADS_CLIENT_SECRET`
- `SNAPCHAT_CLIENT_ID` and `SNAPCHAT_CLIENT_SECRET`

OAuth access and refresh tokens must continue to be stored as Vault references, not environment variables or ordinary table text.

### 3. Vercel — browser-safe Supabase configuration only

Project: **master-ceo-dashboard**

Keep only these browser variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Do not place provider keys, OAuth client secrets, Supabase secret/service-role keys, access tokens, or refresh tokens in any `VITE_` variable. Vite embeds `VITE_` values into the public browser bundle.

## Provider source sites

| Provider | Obtain/manage key at | Exact stored name | Activation role |
|---|---|---|---|
| Runway | Runway Developer Portal → API Keys | `RUNWAY_API_KEY` | VisionWeaver video rendering |
| Gemini | Google AI Studio → API Keys | `GEMINI_API_KEY` | THELMA/VisionWeaver Google model route |
| Anthropic | Claude Console → Settings → API Keys | `ANTHROPIC_API_KEY` | Current VisionWeaver planning stages |
| KIE | KIE API Key Management | `KIE_API_KEY` | Optional image/video/audio model adapters |
| OpenRouter | OpenRouter → Keys | `OPENROUTER_API_KEY` | Multi-model gateway and fallback route |
| OpenAI | OpenAI Platform → API Keys | `OPENAI_API_KEY` | Not yet wired; hold until its direct adapter is added |
| DeepSeek | DeepSeek Platform key management | `DEEPSEEK_API_KEY` | Not yet wired directly; currently planned through OpenRouter |
| Grok/xAI | xAI Console key management | `XAI_API_KEY` | Not yet wired; hold until its adapter is added |
| Google Drive | Google Cloud Console OAuth credentials | OAuth client pair, name to be finalized | Governed evidence service; not yet runtime-wired |
| Social channels | Each platform developer portal | Platform-specific client ID/secret pairs above | CMGIO OAuth connections |

## Safe activation order

1. **Runway** — replace the Vault placeholder; run health validation without generating media.
2. **Anthropic** — replace the Vault placeholder; run a minimal structured-output test.
3. **Gemini** — replace the Vault placeholder; validate identity, quota, and one inexpensive test.
4. **OpenRouter** — create a project-specific key with a low spending limit; validate model discovery and fallback without enabling autopilot.
5. **KIE** — validate balance/credits and one low-cost adapter request.
6. Add direct OpenAI, DeepSeek, or xAI adapters only after the current gateway route is certified.
7. Add Google Drive and social OAuth applications last because they require callback, consent-screen, scope, token-refresh, and revocation testing.

## Per-key operating rules

- Use a dedicated key named for this production system; do not reuse personal experimentation keys.
- Where supported, create separate staging and production keys.
- Set the lowest practical provider spending limit and usage alert before the first generation.
- Restrict the key to the required API/product where the provider supports restrictions.
- Record the provider account owner, creation date, billing source, scopes, quota, and rotation date—but never the secret value.
- After replacement, test health first, then one minimal synthetic transaction.
- Verify cost, receipt, failure routing, retry, audit record, and kill switch before labeling a provider production.
- Rotate or revoke any key ever pasted into chat, source control, screenshots, or a public client.

## Activation status definitions

- **PLACEHOLDER:** the slot exists but cannot authenticate.
- **SET / UNVERIFIED:** a real secret is present, but no provider call has passed.
- **HEALTHY:** authentication and a read-only or minimal health request passed.
- **MANUAL PILOT:** governed synthetic write/generation passed with cost and audit evidence.
- **PRODUCTION:** end-to-end workflow, retry, failure, rollback/recovery, budget limit, and revocation have passed.

## Immediate user procedure

For each key you already possess:

1. Identify the provider.
2. Confirm the provider account and billing project are the intended Estiban Creations account.
3. Open Supabase project `yqealeekngxooyoemfba`.
4. Go to **Database → Vault**.
5. Find the exact matching placeholder secret.
6. Replace its value and save.
7. Do not trigger any production job yet.
8. Report only the provider names completed—never the values.

Once the names are confirmed as replaced, run the provider health and low-cost certification batch one provider at a time.
