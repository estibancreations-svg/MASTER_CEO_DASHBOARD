# Provider key installation matrix

**System:** SYS-CEO-001 / SYS-THELMA-001 / SYS-VISION-001  
**Supabase project:** `yqealeekngxooyoemfba` — Master Dashboard  
**Status:** live installation matrix; activation state varies by provider

## Non-negotiable rule

Do not paste API credentials into ChatGPT, GitHub, screenshots, email, browser code, or any Vercel variable beginning with `VITE_`. Provider credentials belong in the approved Supabase Edge Function secret store or Vault location for that runtime. Update the exact canonical slot; do not create spelling variants.

Canonical names currently include:

- OpenAI: **`OPENAI_API_ACCESS`**
- Gemini: **`GEMINI_CONNECTION`**
- Runway: **`RUNWAY_API_ACCESS`**

Retired credential names must not be used in active runtime code, workflows, registries, instructions, or new environments. Historical applied migrations may retain former names only as immutable provenance.

After installing credentials, report only the slot names completed. Never send the values.

## Installation sequence

1. Sign into the provider site listed below.
2. Create a dedicated Estiban Creations server-side credential.
3. Apply the smallest available scopes, project restrictions, monthly budget and usage alerts.
4. Copy the value once.
5. Open the approved Supabase Edge Function secret store or Vault location and update the matching canonical secret name.
6. Delete the value from clipboard history, Notes, downloads and screenshots.
7. Leave the connector staged until health, cost, privacy, fallback and kill-switch tests pass.

## AI and model providers

| Order | Provider site | Canonical secret slot | Intended use / current state |
| ---: | --- | --- | --- |
| 1 | [OpenAI API Keys](https://platform.openai.com/api-keys) | `OPENAI_API_ACCESS` | Direct THELMA reasoning/tool lane, Ecosystem Scout and governed Codex repair executor; API health verified |
| 2 | [Google AI Studio API Keys](https://aistudio.google.com/app/apikey) | `GEMINI_CONNECTION` | THELMA multimodal/secondary lane and VisionWeaver planning/image work; credential valid, billing/prepayment required |
| 3 | [Runway Developer Portal](https://dev.runwayml.com/) | `RUNWAY_API_ACCESS` | Preferred VisionWeaver production provider; live organization balance verified |
| 4 | [OpenRouter Keys](https://openrouter.ai/settings/keys) | `OPENROUTER_API_KEY` | Separate multi-provider gateway and controlled fallback route |
| 5 | [Anthropic Console](https://console.anthropic.com/settings/keys) | `ANTHROPIC_API_KEY` | Claude reasoning/review lane |
| 6 | [DeepSeek Platform](https://platform.deepseek.com/api_keys) | `DEEPSEEK_API_KEY` | Direct DeepSeek reasoning lane |
| 7 | [xAI Console](https://console.x.ai/) | `XAI_API_KEY` | Direct Grok/xAI lane—not X social OAuth |
| 8 | [KIE.ai](https://kie.ai/) | `KIE_API_KEY` | Optional VisionWeaver image/video/audio gateway |
| 9 | [Kling API documentation](https://klingai.com/global/dev/document-api) | `KLING_ACCESS_KEY`, `KLING_SECRET_KEY` | Kling creative/video route |
| 10 | [Higgsfield Cloud](https://cloud.higgsfield.ai/) | `HIGGSFIELD_API_KEY`, `HIGGSFIELD_API_SECRET` | Higgsfield creative/video route |
| 11 | [ElevenLabs API Keys](https://elevenlabs.io/app/settings/api-keys) | `ELEVENLABS_API_KEY` | Voice generation; use a restricted key and credit quota |
| 12 | [Honcho documentation](https://honcho.dev/docs) | `HONCHO_API_KEY` | Optional managed memory; not required for owned memory |

### Gemini verification note — 2026-08-27

`GEMINI_CONNECTION` passed Google model discovery with HTTP 200. The old runtime target `gemini-2.5-flash` produced a drift message for new users; the system target was updated to `gemini-3.6-flash`. A minimal generation test against that model returned HTTP 429 `RESOURCE_EXHAUSTED`, specifically indicating depleted prepayment credits. Therefore the Gemini state is **credential valid / billing required**. Do not rotate the key because of that 429; fund the intended Google AI Studio project, then rerun the minimal generation test.

OpenAI, Gemini, OpenRouter and ChatGPT interactive projects are separate services/entitlements. A ChatGPT project must never be represented as OpenAI API credit.

## Communications

| Provider site | Vault slot | Setup requirement |
| --- | --- | --- |
| [Slack Apps](https://api.slack.com/apps) | `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, optional `SLACK_APP_TOKEN` | Create an app for Estiban Creations. Use signing-secret verification for inbound events. Add the app token only if Socket Mode is approved. |
| [Telegram Bot API](https://core.telegram.org/bots/api) and BotFather | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` | Create the bot through BotFather. Generate a separate random webhook secret; it is not the bot token. |

## Owned or optional orchestration

| System | Vault slot | Decision |
| --- | --- | --- |
| Paperclip | `PAPERCLIP_API_TOKEN` | Deferred. Create only for a reviewed self-hosted deployment. |
| n8n self-hosted | `N8N_API_KEY`, `N8N_WEBHOOK_SECRET` | Optional bridge only. The owned EC Integration Fabric remains primary. |
| EC Integration Fabric | No new provider key | Owned queue, retry, dead-letter, authorization and audit authority. |

## Insurance and fuel partners

Do not invent credentials for Allstate, The General, Progressive or State Farm. These slots are used only after an approved agency, affiliate or partner agreement provides a real client ID, secret, endpoint, scopes and terms.

| Partner | Reserved Vault slots |
| --- | --- |
| Allstate | `ALLSTATE_CLIENT_ID`, `ALLSTATE_CLIENT_SECRET` |
| The General | `THE_GENERAL_CLIENT_ID`, `THE_GENERAL_CLIENT_SECRET` |
| Progressive | `PROGRESSIVE_CLIENT_ID`, `PROGRESSIVE_CLIENT_SECRET` |
| State Farm | `STATE_FARM_CLIENT_ID`, `STATE_FARM_CLIENT_SECRET` |

## Credentials that are not provider uploads

- `VISIONWEAVER_CRON_SECRET` is an internal signed-worker boundary. Do not replace it with a model credential.
- `THELMA_RESOURCE_CRON_SECRET` and `THELMA_ECOSYSTEM_CRON_SECRET` are internal scheduler boundaries.
- Supabase browser configuration uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Database passwords, service-role/secret values and provider credentials never belong in browser variables.
- The database-backup connection string is handled separately under the recovery runbook.

## Post-install activation order

Each connector advances independently:

`placeholder → installed → credential validated → billing/quota available → synthetic read → synthetic write if required → audit/cost verified → rollback tested → Architect approved → active`

A single successful request is not production certification. THELMA must record provider, model, source evidence, token/credit usage, cost, fallback decision, correlation ID and final status.

## References

- [Supabase Vault](https://supabase.com/docs/guides/database/vault)
- [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets)
- [OpenAI API quickstart](https://platform.openai.com/docs/quickstart/make-your-first-api-request)
- [Gemini API authentication](https://ai.google.dev/api)
