# Provider key installation matrix

**System:** SYS-CEO-001 / SYS-THELMA-001 / SYS-VISION-001  
**Supabase project:** `yqealeekngxooyoemfba` — Master Dashboard  
**Status:** installation-ready; provider execution remains disabled

## Non-negotiable rule

Do not paste API keys into ChatGPT, GitHub, screenshots, email, browser code, or any Vercel variable beginning with `VITE_`. Provider keys belong in **Supabase Dashboard → Master Dashboard project → Database → Vault → Secrets**. Update the existing named slot; do not create a differently named duplicate.

After installing keys, report only the slot names completed—for example, “`OPENAI_API_KEY` installed.” Never send the values.

## Installation sequence

1. Sign into the provider site listed below.
2. Create a dedicated Estiban Creations server-side credential.
3. Apply the smallest available scopes, project restrictions, monthly budget and usage alerts.
4. Copy the value once.
5. Open Supabase Vault and update the matching existing secret name.
6. Delete the value from clipboard history, Notes, downloads and screenshots.
7. Leave the connector staged. Health, cost, privacy, fallback and kill-switch tests come next.

## AI and model providers

| Order | Provider site | Vault slot | Intended use |
| ---: | --- | --- | --- |
| 1 | [Google AI Studio API Keys](https://aistudio.google.com/app/apikey) | `GEMINI_API_KEY` | THELMA multimodal lane and VisionWeaver planning/image work |
| 2 | [OpenAI API Keys](https://platform.openai.com/api-keys) | `OPENAI_API_KEY` | Direct OpenAI reasoning/tool lane |
| 3 | [OpenRouter Keys](https://openrouter.ai/settings/keys) | `OPENROUTER_API_KEY` | Separate multi-provider gateway and fallback route |
| 4 | [Anthropic Console](https://console.anthropic.com/settings/keys) | `ANTHROPIC_API_KEY` | Claude reasoning/review lane |
| 5 | [DeepSeek Platform](https://platform.deepseek.com/api_keys) | `DEEPSEEK_API_KEY` | Direct DeepSeek reasoning lane |
| 6 | [xAI Console](https://console.x.ai/) | `XAI_API_KEY` | Direct Grok/xAI lane—not X social OAuth |
| 7 | [Runway Developer Portal](https://dev.runwayml.com/) | `RUNWAY_API_ACCESS` | VisionWeaver video generation; expected prefix `key_` |
| 8 | [KIE.ai](https://kie.ai/) | `KIE_API_KEY` | Optional VisionWeaver generation gateway |
| 9 | [Kling API documentation](https://klingai.com/global/dev/document-api) | `KLING_ACCESS_KEY`, `KLING_SECRET_KEY` | Kling creative/video route |
| 10 | [Higgsfield Cloud](https://cloud.higgsfield.ai/) | `HIGGSFIELD_API_KEY`, `HIGGSFIELD_API_SECRET` | Higgsfield creative/video route |
| 11 | [ElevenLabs API Keys](https://elevenlabs.io/app/settings/api-keys) | `ELEVENLABS_API_KEY` | Voice generation; use a restricted key and credit quota |
| 12 | [Honcho documentation](https://honcho.dev/docs) | `HONCHO_API_KEY` | Optional managed memory; not required for owned memory |

OpenAI and OpenRouter are separate services, accounts, billing systems and Vault slots.

## Communications

| Provider site | Vault slot | Setup requirement |
| --- | --- | --- |
| [Slack Apps](https://api.slack.com/apps) | `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, optional `SLACK_APP_TOKEN` | Create an app for Estiban Creations. Use signing-secret verification for inbound events. Add the app token only if Socket Mode is approved. |
| [Telegram Bot API](https://core.telegram.org/bots/api) and BotFather inside Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` | Create the bot through BotFather. Generate a separate random webhook secret; it is not the bot token. |

## Owned or optional orchestration

| System | Vault slot | Decision |
| --- | --- | --- |
| Paperclip | `PAPERCLIP_API_TOKEN` | Deferred. Only create this internal token if a reviewed self-hosted Paperclip instance is deployed. |
| n8n self-hosted | `N8N_API_KEY`, `N8N_WEBHOOK_SECRET` | Optional bridge only. The owned EC Integration Fabric remains primary, so no paid n8n account is required. |
| EC Integration Fabric | No new provider key | Already the owned queue, retry, dead-letter, authorization and audit authority. |

## Insurance and fuel partners

Do not invent credentials for Allstate, The General, Progressive or State Farm. These slots are only used after an approved agency, affiliate or partner agreement provides a real client ID, secret, endpoint, scopes and terms.

| Partner | Reserved Vault slots |
| --- | --- |
| Allstate | `ALLSTATE_CLIENT_ID`, `ALLSTATE_CLIENT_SECRET` |
| The General | `THE_GENERAL_CLIENT_ID`, `THE_GENERAL_CLIENT_SECRET` |
| Progressive | `PROGRESSIVE_CLIENT_ID`, `PROGRESSIVE_CLIENT_SECRET` |
| State Farm | `STATE_FARM_CLIENT_ID`, `STATE_FARM_CLIENT_SECRET` |

The registry also includes blank insurance-provider, gas-station/fuel-partner and general-service templates. A template remains deferred until its legal access, endpoint, data classification and failure boundary are known.

## Credentials that are not provider uploads

- `VISIONWEAVER_CRON_SECRET` is an internal signed-worker boundary. Do not replace it with a model key.
- Supabase browser configuration uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Database passwords, service-role/secret keys and provider keys never belong in browser variables.
- The database-backup connection string is handled separately under the recovery runbook.

## Post-install activation order

Each connector advances independently:

`placeholder → installed → health checked → synthetic read → synthetic write if required → audit/cost verified → rollback tested → Architect approved → active`

A single successful request is not production certification. THELMA must record provider, model, source evidence, token/credit usage, cost, fallback decision, correlation ID and final status.

## References

- [Supabase Vault](https://supabase.com/docs/guides/database/vault)
- [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets)
- [OpenAI API quickstart](https://platform.openai.com/docs/quickstart/make-your-first-api-request)
- [Gemini API authentication](https://ai.google.dev/api)
