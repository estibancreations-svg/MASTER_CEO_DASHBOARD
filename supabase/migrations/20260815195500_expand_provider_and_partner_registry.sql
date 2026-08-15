-- Expand the governed provider and partner connector registry.
-- Live change applied and verified 2026-08-15. Secret values never belong in this file.

alter table public.ec_connectors
  add column if not exists required_secrets text[] not null default '{}',
  add column if not exists docs_url text,
  add column if not exists endpoint_url text,
  add column if not exists credential_status text not null default 'not_configured',
  add column if not exists is_template boolean not null default false,
  add column if not exists notes text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ec_connectors'::regclass
      and conname = 'ec_connectors_credential_status_check'
  ) then
    alter table public.ec_connectors
      add constraint ec_connectors_credential_status_check
      check (credential_status in (
        'not_configured','placeholder','partner_access_required',
        'configured','healthy','degraded','revoked'
      ));
  end if;
end $$;

with rows(connector_key,display_name,category,connection_state,transport,capabilities,credential_mode,required_secrets,docs_url,endpoint_url,credential_status,is_template,notes) as (
  values
  ('openai','OpenAI','ai_model','staged','https',array['text','reasoning','vision','image','embeddings'], 'api_key',array['OPENAI_API_KEY'],'https://platform.openai.com/docs','https://api.openai.com','placeholder',false,'Direct THELMA route; activate only after health, cost and privacy checks.'),
  ('xai_grok','Grok / xAI','ai_model','staged','https',array['text','reasoning'], 'api_key',array['XAI_API_KEY'],'https://docs.x.ai/','https://api.x.ai','placeholder',false,'Direct THELMA route.'),
  ('deepseek','DeepSeek','ai_model','staged','https',array['text','reasoning'], 'api_key',array['DEEPSEEK_API_KEY'],'https://api-docs.deepseek.com/','https://api.deepseek.com','placeholder',false,'Direct THELMA route.'),
  ('paperclip','Paperclip','orchestration','deferred','https',array['agent_orchestration'], 'api_token',array['PAPERCLIP_API_TOKEN'],'https://paperclip.ing/docs',null,'placeholder',false,'Optional/self-hosted; not workflow authority.'),
  ('anthropic_claude','Claude / Anthropic','ai_model','staged','https',array['text','reasoning','vision'], 'api_key',array['ANTHROPIC_API_KEY'],'https://docs.anthropic.com/','https://api.anthropic.com','placeholder',false,'Reuses the existing Anthropic credential slot.'),
  ('kling','Kling AI','creative_ai','staged','https',array['video_generation'], 'key_pair',array['KLING_ACCESS_KEY','KLING_SECRET_KEY'],'https://kling.ai/document-api/apiReference/commonInfo',null,'placeholder',false,'VisionWeaver provider; interpreted from the note “King”.'),
  ('slack','Slack','communications','staged','https',array['messages','events','interactive_actions'], 'oauth_app',array['SLACK_BOT_TOKEN','SLACK_SIGNING_SECRET','SLACK_APP_TOKEN'],'https://api.slack.com/apps','https://slack.com/api','placeholder',false,'Verify inbound request signatures.'),
  ('honcho','Honcho','memory','staged','https',array['memory','context'], 'api_key',array['HONCHO_API_KEY'],'https://honcho.dev/docs/v3/documentation/introduction/overview',null,'placeholder',false,'Optional THELMA memory/context provider.'),
  ('telegram','Telegram','communications','staged','https',array['bot_messages','webhooks'], 'bot_token',array['TELEGRAM_BOT_TOKEN','TELEGRAM_WEBHOOK_SECRET'],'https://core.telegram.org/bots/api','https://api.telegram.org','placeholder',false,'Use a webhook secret and server-side token.'),
  ('elevenlabs','ElevenLabs','voice_ai','staged','https',array['text_to_speech','speech_to_text'], 'api_key',array['ELEVENLABS_API_KEY'],'https://elevenlabs.io/docs/api-reference/authentication','https://api.elevenlabs.io','placeholder',false,'Use restricted key scopes and quota.'),
  ('higgsfield','Higgsfield AI','creative_ai','staged','https',array['image_generation','video_generation'], 'key_pair',array['HIGGSFIELD_API_KEY','HIGGSFIELD_API_SECRET'],'https://github.com/higgsfield-ai/higgsfield-client',null,'placeholder',false,'VisionWeaver creative provider.'),
  ('n8n_self_hosted','n8n Optional Self-Hosted','orchestration','deferred','https',array['workflow_bridge','webhooks'], 'api_key',array['N8N_API_KEY','N8N_WEBHOOK_SECRET'],'https://docs.n8n.io/hosting/','', 'placeholder',false,'Optional bridge only; EC Integration Fabric remains primary.'),
  ('allstate','Allstate','insurance_partner','deferred','partner',array['quotes','policy_service'], 'oauth_client',array['ALLSTATE_CLIENT_ID','ALLSTATE_CLIENT_SECRET'],null,null,'partner_access_required',false,'No public production API asserted; approved partner access required.'),
  ('the_general','The General','insurance_partner','deferred','partner',array['quotes','policy_service'], 'oauth_client',array['THE_GENERAL_CLIENT_ID','THE_GENERAL_CLIENT_SECRET'],null,null,'partner_access_required',false,'No public production API asserted; approved partner access required.'),
  ('progressive','Progressive','insurance_partner','deferred','partner',array['quotes','policy_service'], 'oauth_client',array['PROGRESSIVE_CLIENT_ID','PROGRESSIVE_CLIENT_SECRET'],null,null,'partner_access_required',false,'No public production API asserted; approved partner access required.'),
  ('state_farm','State Farm','insurance_partner','deferred','partner',array['quotes','policy_service'], 'oauth_client',array['STATE_FARM_CLIENT_ID','STATE_FARM_CLIENT_SECRET'],null,null,'partner_access_required',false,'No public production API asserted; approved partner access required.'),
  ('insurance_provider_template','Insurance Provider — Blank','insurance_partner','deferred','partner',array[]::text[], 'to_be_defined',array[]::text[],null,null,'not_configured',true,'Reusable partner template.'),
  ('gas_station_template','Gas Station / Fuel Provider — Blank','fuel_partner','deferred','partner',array[]::text[], 'to_be_defined',array[]::text[],null,null,'not_configured',true,'Reusable fleet, fuel or gas-station partner template.'),
  ('external_service_template','External Service — Blank','external_service','deferred','to_be_defined',array[]::text[], 'to_be_defined',array[]::text[],null,null,'not_configured',true,'Reusable governed external-service template.')
)
insert into public.ec_connectors (
  organization_id,connector_key,display_name,category,connection_state,transport,
  capabilities,credential_mode,required_secrets,docs_url,endpoint_url,
  credential_status,is_template,notes
)
select
  '20e10428-4443-4324-b36a-e68d64ec26ed'::uuid,
  connector_key,display_name,category,connection_state,transport,
  to_jsonb(capabilities),credential_mode,required_secrets,docs_url,endpoint_url,
  credential_status,is_template,notes
from rows
on conflict (organization_id,connector_key) do update set
  display_name=excluded.display_name, category=excluded.category,
  connection_state=excluded.connection_state, transport=excluded.transport,
  capabilities=excluded.capabilities, credential_mode=excluded.credential_mode,
  required_secrets=excluded.required_secrets, docs_url=excluded.docs_url,
  endpoint_url=excluded.endpoint_url, credential_status=excluded.credential_status,
  is_template=excluded.is_template, notes=excluded.notes, updated_at=now();

do $$
declare
  slot text;
  slots text[] := array[
    'OPENAI_API_KEY','XAI_API_KEY','DEEPSEEK_API_KEY','PAPERCLIP_API_TOKEN',
    'KLING_ACCESS_KEY','KLING_SECRET_KEY','SLACK_BOT_TOKEN','SLACK_SIGNING_SECRET',
    'SLACK_APP_TOKEN','HONCHO_API_KEY','TELEGRAM_BOT_TOKEN','TELEGRAM_WEBHOOK_SECRET',
    'ELEVENLABS_API_KEY','HIGGSFIELD_API_KEY','HIGGSFIELD_API_SECRET',
    'N8N_API_KEY','N8N_WEBHOOK_SECRET','ALLSTATE_CLIENT_ID','ALLSTATE_CLIENT_SECRET',
    'THE_GENERAL_CLIENT_ID','THE_GENERAL_CLIENT_SECRET','PROGRESSIVE_CLIENT_ID',
    'PROGRESSIVE_CLIENT_SECRET','STATE_FARM_CLIENT_ID','STATE_FARM_CLIENT_SECRET'
  ];
begin
  foreach slot in array slots loop
    if not exists (select 1 from vault.secrets where name=slot) then
      perform vault.create_secret(
        'PLACEHOLDER_REPLACE_ME', slot,
        'Staged provider or partner credential; replace in Vault and certify before activation.'
      );
    end if;
  end loop;
end $$;


with integrations(integration_key,display_name,owning_system,connection_type,endpoint_class,status,capabilities,required_secrets,provenance) as (
  values
  ('openai','OpenAI','SYS-THELMA-001','ai_provider','server_only','planned',array['model_routing','reasoning','vision','image'],array['OPENAI_API_KEY'],'{"source":"API activation inventory","verified_api":true}'::jsonb),
  ('xai-grok','Grok / xAI','SYS-THELMA-001','ai_provider','server_only','planned',array['model_routing','reasoning'],array['XAI_API_KEY'],'{"source":"API activation inventory","verified_api":true}'::jsonb),
  ('deepseek','DeepSeek','SYS-THELMA-001','ai_provider','server_only','planned',array['model_routing','reasoning'],array['DEEPSEEK_API_KEY'],'{"source":"API activation inventory","verified_api":true}'::jsonb),
  ('anthropic-claude','Claude / Anthropic','SYS-THELMA-001','ai_provider','server_only','planned',array['model_routing','reasoning','vision'],array['ANTHROPIC_API_KEY'],'{"source":"existing VisionWeaver notes","verified_api":true}'::jsonb),
  ('paperclip','Paperclip','SYS-THELMA-001','optional_orchestration','server_only','planned',array['agent_orchestration'],array['PAPERCLIP_API_TOKEN'],'{"source":"system notes","self_hosted_optional":true}'::jsonb),
  ('slack','Slack','SYS-THELMA-001','communications','server_only','planned',array['messages','events','interactive_actions'],array['SLACK_BOT_TOKEN','SLACK_SIGNING_SECRET','SLACK_APP_TOKEN'],'{"source":"system notes","verified_api":true}'::jsonb),
  ('honcho','Honcho','SYS-THELMA-001','memory_provider','server_only','planned',array['memory','context'],array['HONCHO_API_KEY'],'{"source":"system notes","verified_api":true}'::jsonb),
  ('telegram','Telegram','SYS-THELMA-001','communications','server_only','planned',array['bot_messages','webhooks'],array['TELEGRAM_BOT_TOKEN','TELEGRAM_WEBHOOK_SECRET'],'{"source":"system notes","verified_api":true}'::jsonb),
  ('n8n-self-hosted','n8n (Optional Self-Hosted)','SYS-THELMA-001','optional_orchestration','server_only','planned',array['workflow_bridge','webhooks'],array['N8N_API_KEY','N8N_WEBHOOK_SECRET'],'{"source":"system notes","self_hosted_optional":true,"owned_fabric_primary":true}'::jsonb),
  ('kling','Kling AI','SYS-VISION-001','creative_provider','server_only','planned',array['video_generation'],array['KLING_ACCESS_KEY','KLING_SECRET_KEY'],'{"source":"system notes; interpreted from King","verified_api":true}'::jsonb),
  ('elevenlabs','ElevenLabs','SYS-VISION-001','voice_provider','server_only','planned',array['text_to_speech','speech_to_text'],array['ELEVENLABS_API_KEY'],'{"source":"system notes","verified_api":true}'::jsonb),
  ('higgsfield','Higgsfield AI','SYS-VISION-001','creative_provider','server_only','planned',array['image_generation','video_generation'],array['HIGGSFIELD_API_KEY','HIGGSFIELD_API_SECRET'],'{"source":"system notes","verified_api":true}'::jsonb),
  ('allstate','Allstate','SYS-THELMA-001','insurance_partner','partner_only','planned',array['quotes','policy_service'],array['ALLSTATE_CLIENT_ID','ALLSTATE_CLIENT_SECRET'],'{"source":"THELMA notes","partner_access_required":true,"public_api_asserted":false}'::jsonb),
  ('the-general','The General','SYS-THELMA-001','insurance_partner','partner_only','planned',array['quotes','policy_service'],array['THE_GENERAL_CLIENT_ID','THE_GENERAL_CLIENT_SECRET'],'{"source":"THELMA notes","partner_access_required":true,"public_api_asserted":false}'::jsonb),
  ('progressive','Progressive','SYS-THELMA-001','insurance_partner','partner_only','planned',array['quotes','policy_service'],array['PROGRESSIVE_CLIENT_ID','PROGRESSIVE_CLIENT_SECRET'],'{"source":"THELMA notes","partner_access_required":true,"public_api_asserted":false}'::jsonb),
  ('state-farm','State Farm','SYS-THELMA-001','insurance_partner','partner_only','planned',array['quotes','policy_service'],array['STATE_FARM_CLIENT_ID','STATE_FARM_CLIENT_SECRET'],'{"source":"THELMA notes","partner_access_required":true,"public_api_asserted":false}'::jsonb)
)
insert into public.ceo_integrations (
  organization_id,integration_key,display_name,owning_system,connection_type,
  endpoint_class,status,capabilities,required_secrets,provenance
)
select
  '20e10428-4443-4324-b36a-e68d64ec26ed'::uuid,
  integration_key,display_name,owning_system,connection_type,endpoint_class,status,
  to_jsonb(capabilities),required_secrets,provenance
from integrations
on conflict (organization_id,integration_key) do update set
  display_name=excluded.display_name, owning_system=excluded.owning_system,
  connection_type=excluded.connection_type, endpoint_class=excluded.endpoint_class,
  status=excluded.status, capabilities=excluded.capabilities,
  required_secrets=excluded.required_secrets, provenance=excluded.provenance,
  updated_at=now();
