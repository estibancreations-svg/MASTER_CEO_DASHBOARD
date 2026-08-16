with target_org as (
  select id from public.ceo_organizations where slug='estiban-creations' limit 1
), rows(connector_key,display_name,category,connection_state,transport,capabilities,credential_mode,required_secrets,docs_url,endpoint_url,credential_status,notes) as (
  values
   ('google_gemini','Google Gemini','ai_model','staged','https','["text","vision","multimodal","generation"]'::jsonb,'api_key',array['GEMINI_API_KEY']::text[],'https://ai.google.dev/api','https://generativelanguage.googleapis.com','placeholder','Direct Gemini route. Credential remains non-production until health, privacy, cost and fallback tests pass.'),
   ('openrouter','OpenRouter','ai_gateway','staged','https','["model_gateway","fallback_routing","usage"]'::jsonb,'api_key',array['OPENROUTER_API_KEY']::text[],'https://openrouter.ai/docs','https://openrouter.ai/api','placeholder','Separate gateway from OpenAI. Activation requires provider/model allowlists and cost controls.'),
   ('runway','Runway','creative_ai','staged','https','["text_to_video","image_to_video","generation"]'::jsonb,'api_key',array['RUNWAY_API_KEY']::text[],'https://docs.dev.runwayml.com','https://api.dev.runwayml.com','placeholder','VisionWeaver video-generation provider. Keys must remain server-side.'),
   ('kie','KIE.ai','creative_ai','staged','https','["generation_gateway","image","video"]'::jsonb,'api_key',array['KIE_API_KEY']::text[],'https://docs.kie.ai','https://api.kie.ai','placeholder','Optional creative gateway with Runway fallback; no live execution until certified.')
)
insert into public.ec_connectors(
  organization_id,connector_key,display_name,category,connection_state,transport,capabilities,
  credential_mode,required_secrets,docs_url,endpoint_url,credential_status,is_template,notes
)
select o.id,r.connector_key,r.display_name,r.category,r.connection_state,r.transport,r.capabilities,
       r.credential_mode,r.required_secrets,r.docs_url,r.endpoint_url,r.credential_status,false,r.notes
from target_org o cross join rows r
on conflict (organization_id,connector_key) do update set
 display_name=excluded.display_name,
 category=excluded.category,
 connection_state=excluded.connection_state,
 transport=excluded.transport,
 capabilities=excluded.capabilities,
 credential_mode=excluded.credential_mode,
 required_secrets=excluded.required_secrets,
 docs_url=excluded.docs_url,
 endpoint_url=excluded.endpoint_url,
 credential_status=excluded.credential_status,
 notes=excluded.notes,
 updated_at=now();

with target_org as (
  select id from public.ceo_organizations where slug='estiban-creations' limit 1
), rows(integration_key,display_name,owning_system,connection_type,endpoint_class,capabilities,required_secrets,provenance) as (
  values
   ('google-gemini','Google Gemini','SYS-THELMA-001','ai_model','server_side','["text","vision","multimodal","generation"]'::jsonb,array['GEMINI_API_KEY']::text[],'{"registry":"pre-key-closeout","activation":"provider-gated"}'::jsonb),
   ('openrouter','OpenRouter','SYS-THELMA-001','ai_gateway','server_side','["model_gateway","fallback_routing","usage"]'::jsonb,array['OPENROUTER_API_KEY']::text[],'{"registry":"pre-key-closeout","activation":"provider-gated"}'::jsonb),
   ('runway','Runway','SYS-VISION-001','creative_ai','server_side','["text_to_video","image_to_video","generation"]'::jsonb,array['RUNWAY_API_KEY']::text[],'{"registry":"pre-key-closeout","activation":"provider-gated"}'::jsonb),
   ('kie','KIE.ai','SYS-VISION-001','creative_ai','server_side','["generation_gateway","image","video"]'::jsonb,array['KIE_API_KEY']::text[],'{"registry":"pre-key-closeout","activation":"provider-gated"}'::jsonb)
)
insert into public.ceo_integrations(
 organization_id,integration_key,display_name,owning_system,connection_type,endpoint_class,status,capabilities,required_secrets,provenance
)
select o.id,r.integration_key,r.display_name,r.owning_system,r.connection_type,r.endpoint_class,'planned',r.capabilities,r.required_secrets,r.provenance
from target_org o cross join rows r
on conflict (organization_id,integration_key) do update set
 display_name=excluded.display_name,
 owning_system=excluded.owning_system,
 connection_type=excluded.connection_type,
 endpoint_class=excluded.endpoint_class,
 status='planned',
 capabilities=excluded.capabilities,
 required_secrets=excluded.required_secrets,
 provenance=excluded.provenance,
 updated_at=now();
