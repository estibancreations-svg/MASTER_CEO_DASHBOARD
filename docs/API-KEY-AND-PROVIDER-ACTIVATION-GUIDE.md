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


## Expanded provider and partner registry — 2026-08-15

All entries below are registered but remain **staged**, **deferred**, or **partner access required** until a real credential and a governed health test pass.

| Connection | Get or manage credentials | Vault slot(s) | State |
|---|---|---|---|
| OpenAI | [OpenAI API keys](https://platform.openai.com/api-keys) | `OPENAI_API_KEY` | Staged direct THELMA route |
| Grok / xAI | [xAI Console](https://console.x.ai/) | `XAI_API_KEY` | Staged direct THELMA route |
| DeepSeek | [DeepSeek API keys](https://platform.deepseek.com/api_keys) | `DEEPSEEK_API_KEY` | Staged direct THELMA route |
| Claude / Anthropic | [Anthropic Console](https://console.anthropic.com/settings/keys) | `ANTHROPIC_API_KEY` | Staged; reuses the existing Anthropic slot |
| Paperclip | [Paperclip documentation](https://paperclip.ing/docs) or the administration screen on the self-hosted deployment | `PAPERCLIP_API_TOKEN` | Optional/self-hosted agent orchestration |
| Kling AI | [Kling API documentation](https://kling.ai/document-api/apiReference/commonInfo) | `KLING_ACCESS_KEY`, `KLING_SECRET_KEY` | Staged VisionWeaver provider; “King” was interpreted as Kling |
| Slack | [Slack apps](https://api.slack.com/apps) | `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, optional `SLACK_APP_TOKEN` | Staged communication channel |
| Honcho | [Honcho application](https://app.honcho.dev/) | `HONCHO_API_KEY` | Staged memory/context provider |
| Telegram | Create/manage the bot with [BotFather](https://t.me/BotFather) | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` | Staged communication channel |
| ElevenLabs | [ElevenLabs API keys](https://elevenlabs.io/app/settings/api-keys) | `ELEVENLABS_API_KEY` | Staged voice provider |
| Higgsfield AI | [Higgsfield Cloud](https://cloud.higgsfield.ai/) | `HIGGSFIELD_API_KEY`, `HIGGSFIELD_API_SECRET` | Staged VisionWeaver provider |
| n8n self-hosted | In the self-hosted n8n UI: Settings → n8n API; create the webhook secret internally | `N8N_API_KEY`, `N8N_WEBHOOK_SECRET` | Optional bridge only; EC Integration Fabric remains primary |

### Partner-only connection templates

Allstate, The General, Progressive, and State Farm have been registered as **partner access required**. Their client ID and client secret slots exist, but no public production API is asserted. Only enter credentials issued under an approved agency, vendor, affiliate, fleet, fuel, or enterprise agreement.

| Template | Vault slot(s) |
|---|---|
| Allstate | `ALLSTATE_CLIENT_ID`, `ALLSTATE_CLIENT_SECRET` |
| The General | `THE_GENERAL_CLIENT_ID`, `THE_GENERAL_CLIENT_SECRET` |
| Progressive | `PROGRESSIVE_CLIENT_ID`, `PROGRESSIVE_CLIENT_SECRET` |
| State Farm | `STATE_FARM_CLIENT_ID`, `STATE_FARM_CLIENT_SECRET` |
| Insurance provider blank | Add provider-specific names only after partner documentation is approved |
| Gas station / fuel provider blank | Add provider-specific names only after partner documentation is approved |
| General external service blank | Reusable governed template for future services |

Do not place any of these values in Vercel `VITE_` variables or browser code. Replace only the exact placeholders in **Supabase project `yqealeekngxooyoemfba` → Database → Vault**.
