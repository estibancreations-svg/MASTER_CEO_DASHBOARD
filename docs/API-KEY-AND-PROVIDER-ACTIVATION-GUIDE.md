# API Key and Provider Activation Guide

**System:** Estiban Creations Master CEO Dashboard  
**Date:** 2026-08-15; OpenAI credential naming updated 2026-08-26  
**Rule:** Never paste secrets into ChatGPT, GitHub, frontend variables, screenshots, tickets, or committed files.

## Current inventory

The live project is inspected by secret name/status only. Secret values are never recorded in this guide.

| Credential slot | Current status | Runtime consumer | Purpose |
|---|---:|---|---|
| `VISIONWEAVER_CRON_SECRET` | SET | VisionWeaver scheduler boundary | Authorizes the internal scheduled invocation |
| `RUNWAY_API_ACCESS` | configured separately | VisionWeaver orchestrator | Submit and poll video-generation jobs |
| `ANTHROPIC_API_KEY` | configured separately | VisionWeaver/THELMA | Planning and reasoning lane |
| `GEMINI_API_KEY` | configured separately | Provider health registry / routing | Gemini text/image capability |
| `KIE_API_KEY` | configured separately | Provider health registry / adapters | KIE-hosted image, video, and audio models |
| `OPENROUTER_API_KEY` | configured separately | THELMA routing / fallback | Multi-model routing and controlled fallback |
| `OPENAI_API_ACCESS` | SET / UNVERIFIED | THELMA AI + governed Codex repair workflow | Direct OpenAI reasoning/tool lane |

## Canonical OpenAI naming

`OPENAI_API_ACCESS` is the only active OpenAI credential name for Estiban Creations systems. Do not create, request, document, or wire the retired KEY-based OpenAI name into runtime code, GitHub Actions, Supabase registries, THELMA, Codex, provider activation instructions, or future environments. Historical applied migrations may retain the former name only as immutable provenance and are superseded by the canonical rename migration.

## Where each class of value belongs

### 1. Supabase Edge Function Secrets — model and media provider access

Use the Supabase project **yqealeekngxooyoemfba** and open **Edge Functions → Secrets**. Create or update the exact secret name. Do not create spelling variants.

Put these in Edge Function Secrets as applicable:

- `RUNWAY_API_ACCESS`
- `OPENAI_API_ACCESS`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `KIE_API_KEY`
- `OPENROUTER_API_KEY`

THELMA and VisionWeaver runtimes read Edge Function Secrets first and may use an exact-name Supabase Vault fallback where implemented. Provider access must never be placed in Vercel or any `VITE_` variable.

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

Keep only browser-safe variables such as:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Do not place provider credentials, OAuth client secrets, Supabase secret/service-role values, access tokens, or refresh tokens in any `VITE_` variable. Vite embeds `VITE_` values into the public browser bundle.

## Provider source sites

| Provider | Obtain/manage credential at | Exact stored name | Activation role |
|---|---|---|---|
| Runway | Runway Developer Portal → API Keys | `RUNWAY_API_ACCESS` | VisionWeaver video rendering |
| OpenAI | OpenAI Platform → API Keys | `OPENAI_API_ACCESS` | THELMA direct model route and governed Codex repair executor |
| Gemini | Google AI Studio → API Keys | `GEMINI_API_KEY` | THELMA/VisionWeaver Google model route |
| Anthropic | Claude Console → Settings → API Keys | `ANTHROPIC_API_KEY` | VisionWeaver/THELMA reasoning stages |
| KIE | KIE API Key Management | `KIE_API_KEY` | Optional image/video/audio model adapters |
| OpenRouter | OpenRouter → Keys | `OPENROUTER_API_KEY` | Multi-model gateway and fallback route |
| DeepSeek | DeepSeek Platform key management | `DEEPSEEK_API_KEY` | Planned direct reasoning lane |
| Grok/xAI | xAI Console key management | `XAI_API_KEY` | Planned direct xAI lane |
| Google Drive | Google Cloud Console OAuth credentials | OAuth client pair, name to be finalized | Governed evidence service |
| Social channels | Each platform developer portal | Platform-specific client ID/secret pairs | CMGIO OAuth connections |

## Safe activation order

1. **OpenAI** — `OPENAI_API_ACCESS` is now the canonical installed slot; perform a minimal authenticated THELMA health/conversation test before calling it healthy.
2. **Runway** — validate `RUNWAY_API_ACCESS` without generating unnecessary media.
3. **Anthropic** — run a minimal structured-output test.
4. **Gemini** — validate identity, quota, and one inexpensive test.
5. **OpenRouter** — validate model discovery and fallback without enabling autopilot.
6. **KIE** — validate balance/credits and one low-cost adapter request.
7. Add direct DeepSeek or xAI adapters only after their routing contracts are certified.
8. Add Google Drive and social OAuth applications after callback, consent-screen, scope, token-refresh, and revocation testing.

## Per-credential operating rules

- Use a dedicated credential named for this production system; do not reuse personal experimentation credentials.
- Where supported, create separate staging and production credentials.
- Set the lowest practical provider spending limit and usage alert before the first generation.
- Restrict the credential to the required API/product where the provider supports restrictions.
- Record the provider account owner, creation date, billing source, scopes, quota, and rotation date—but never the secret value.
- After replacement, test health first, then one minimal synthetic transaction.
- Verify cost, receipt, failure routing, retry, audit record, and kill switch before labeling a provider production.
- Rotate or revoke any credential ever pasted into chat, source control, screenshots, or a public client.

## Activation status definitions

- **PLACEHOLDER:** the slot exists but cannot authenticate.
- **SET / UNVERIFIED:** a real credential is present or user-confirmed, but no provider call has passed.
- **HEALTHY:** authentication and a read-only or minimal health request passed.
- **MANUAL PILOT:** governed synthetic write/generation passed with cost and audit evidence.
- **PRODUCTION:** end-to-end workflow, retry, failure, rollback/recovery, budget limit, and revocation have passed.

## Immediate user procedure

For each provider credential you already possess:

1. Identify the provider.
2. Confirm the provider account and billing project are the intended Estiban Creations account.
3. Open Supabase project `yqealeekngxooyoemfba`.
4. Go to the approved Edge Function Secrets or Vault location for that runtime.
5. Find the exact canonical slot.
6. Replace its value and save.
7. Do not trigger an uncontrolled production job.
8. Report only the provider/slot names completed—never the values.

For OpenAI, the exact canonical slot is `OPENAI_API_ACCESS`.

## Expanded provider and partner registry — 2026-08-15

All entries below remain **staged**, **deferred**, or **partner access required** until a real credential and governed health test pass.

| Connection | Get or manage credentials | Vault/secret slot(s) | State |
|---|---|---|---|
| OpenAI | [OpenAI API keys](https://platform.openai.com/api-keys) | `OPENAI_API_ACCESS` | Canonical THELMA/Codex route; health certification pending |
| Grok / xAI | [xAI Console](https://console.x.ai/) | `XAI_API_KEY` | Staged direct THELMA route |
| DeepSeek | [DeepSeek API keys](https://platform.deepseek.com/api_keys) | `DEEPSEEK_API_KEY` | Staged direct THELMA route |
| Claude / Anthropic | [Anthropic Console](https://console.anthropic.com/settings/keys) | `ANTHROPIC_API_KEY` | Staged; reuses the existing Anthropic slot |
| Paperclip | [Paperclip documentation](https://paperclip.ing/docs) or the administration screen on the self-hosted deployment | `PAPERCLIP_API_TOKEN` | Optional/self-hosted agent orchestration |
| Kling AI | [Kling API documentation](https://kling.ai/document-api/apiReference/commonInfo) | `KLING_ACCESS_KEY`, `KLING_SECRET_KEY` | Staged VisionWeaver provider |
| Slack | [Slack apps](https://api.slack.com/apps) | `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, optional `SLACK_APP_TOKEN` | Staged communication channel |
| Honcho | [Honcho application](https://app.honcho.dev/) | `HONCHO_API_KEY` | Staged memory/context provider |
| Telegram | Create/manage the bot with [BotFather](https://t.me/BotFather) | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` | Staged communication channel |
| ElevenLabs | [ElevenLabs API keys](https://elevenlabs.io/app/settings/api-keys) | `ELEVENLABS_API_KEY` | Staged voice provider |
| Higgsfield AI | [Higgsfield Cloud](https://cloud.higgsfield.ai/) | `HIGGSFIELD_API_KEY`, `HIGGSFIELD_API_SECRET` | Staged VisionWeaver provider |
| n8n self-hosted | In the self-hosted n8n UI: Settings → n8n API; create the webhook secret internally | `N8N_API_KEY`, `N8N_WEBHOOK_SECRET` | Optional bridge only; EC Integration Fabric remains primary |

### Partner-only connection templates

Allstate, The General, Progressive, and State Farm are registered as **partner access required**. Their client ID and client secret slots exist, but no public production API is asserted. Only enter credentials issued under an approved agency, vendor, affiliate, fleet, fuel, or enterprise agreement.

| Template | Vault slot(s) |
|---|---|
| Allstate | `ALLSTATE_CLIENT_ID`, `ALLSTATE_CLIENT_SECRET` |
| The General | `THE_GENERAL_CLIENT_ID`, `THE_GENERAL_CLIENT_SECRET` |
| Progressive | `PROGRESSIVE_CLIENT_ID`, `PROGRESSIVE_CLIENT_SECRET` |
| State Farm | `STATE_FARM_CLIENT_ID`, `STATE_FARM_CLIENT_SECRET` |
| Insurance provider blank | Add provider-specific names only after partner documentation is approved |
| Gas station / fuel provider blank | Add provider-specific names only after partner documentation is approved |
| General external service blank | Reusable governed template for future services |

Do not place any of these values in Vercel `VITE_` variables or browser code. Use only the exact canonical server-side secret name for each runtime.
