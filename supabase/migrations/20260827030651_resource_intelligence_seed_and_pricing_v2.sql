update public.credit_pools
set starting_balance_usd=500,
    remaining_balance_usd=case when remaining_balance_usd=50000 then 500 else remaining_balance_usd end,
    notes=trim(coalesce(notes,'')||' Canonical unit correction 2026-08-27: pool label denotes 50,000 Runway credits; Runway documents $0.01/credit. Live remaining balance still requires provider synchronization.'),
    last_synced_at=now()
where pool_id='runway_developer_50k' and starting_balance_usd=50000;

insert into public.resource_accounts(organization_id,provider_key,account_key,display_name,resource_class,unit,starting_quantity,current_quantity,unit_usd,balance_method,balance_confidence,is_automatable,commercial_use_state,privacy_state,preferred_rank,source_url,status,metadata)
select o.id,'runway','developer_api','Runway API Developer Credits','PREPAID_CREDIT','credits',50000,50000,0.01,'USAGE_DERIVED','LOW',true,'APPROVED','CONDITIONAL',1,'https://docs.dev.runwayml.com/guides/pricing/','NEEDS_SYNC',jsonb_build_object('preferred_for','VisionWeaver production','reported_pool_id','runway_developer_50k','note','Runway is a go-to provider; starting quantity comes from the historical 50k-credit record and must be reconciled against current provider usage/balance.')
from public.ceo_organizations o
on conflict(organization_id,provider_key,account_key) do update set
 display_name=excluded.display_name,resource_class=excluded.resource_class,unit=excluded.unit,unit_usd=excluded.unit_usd,balance_method=excluded.balance_method,preferred_rank=excluded.preferred_rank,source_url=excluded.source_url,metadata=excluded.metadata,updated_at=now();

insert into public.resource_accounts(organization_id,provider_key,account_key,display_name,resource_class,unit,starting_quantity,current_quantity,unit_usd,balance_method,balance_confidence,is_automatable,commercial_use_state,privacy_state,preferred_rank,expires_at,status,metadata)
select o.id,'google-cloud','trial-infrastructure','Google Cloud $300 infrastructure trial','PROMOTIONAL_CREDIT','usd',300,300,1,'MANUAL','LOW',true,'CONDITIONAL','CONDITIONAL',50,'2026-10-15T19:20:19Z','NEEDS_SYNC',jsonb_build_object('restriction','Infrastructure only; do not treat as Gemini model credit.')
from public.ceo_organizations o on conflict(organization_id,provider_key,account_key) do nothing;

insert into public.resource_accounts(organization_id,provider_key,account_key,display_name,resource_class,unit,unit_usd,balance_method,balance_confidence,is_automatable,commercial_use_state,privacy_state,preferred_rank,source_url,status,metadata)
select o.id,'openai','api-payg','OpenAI API / THELMA project','PAYG','usd',1,'BUDGET_DERIVED','MEDIUM',true,'APPROVED','CONDITIONAL',2,'https://developers.openai.com/api/docs/models','ACTIVE',jsonb_build_object('credential','OPENAI_API_ACCESS','note','PAYG resource: report tracked spend and budget remaining rather than a fictional credit balance.')
from public.ceo_organizations o
on conflict(organization_id,provider_key,account_key) do update set source_url=excluded.source_url,metadata=excluded.metadata,status='ACTIVE',updated_at=now();

insert into public.resource_accounts(organization_id,provider_key,account_key,display_name,resource_class,unit,balance_method,balance_confidence,is_automatable,commercial_use_state,privacy_state,preferred_rank,status,metadata)
select o.id,'chatgpt','interactive-project','ChatGPT interactive project/workspace','INTERACTIVE_ONLY','project','MANUAL','UNKNOWN',false,'CONDITIONAL','CONDITIONAL',3,'STAGED',jsonb_build_object('note','Manual/interactive entitlement. May be deliberately selected for a project, but it is not an API credit pool and must not be treated as autonomous backend compute.')
from public.ceo_organizations o on conflict(organization_id,provider_key,account_key) do nothing;

insert into public.resource_accounts(organization_id,provider_key,account_key,display_name,resource_class,unit,balance_method,balance_confidence,is_automatable,commercial_use_state,privacy_state,preferred_rank,status,metadata)
select o.id,'gemini','api','Gemini API','FREE_API','quota','MANUAL','LOW',true,'CONDITIONAL','CONDITIONAL',4,'NEEDS_SYNC',jsonb_build_object('note','Free-tier availability is model/project-specific and must be refreshed from current Gemini quotas; stale image-free assumptions are not authoritative.')
from public.ceo_organizations o on conflict(organization_id,provider_key,account_key) do nothing;

insert into public.system_resource_policies(organization_id,system_key,free_included_first,manual_override_allowed,runway_preferred,openai_project_preferred,commercial_use_required,minimum_quality_score,preferred_provider_order,preferred_models,notes)
select s.organization_id,s.system_key,true,true,(s.system_key='SYS-VISION-001'),(s.system_key in ('SYS-CEO-001','SYS-THELMA-001','SYS-QC-001','SYS-TRAINING-001')),true,
case when s.system_key in ('SYS-VISION-001','SYS-ADS-001') then 88 when s.system_key in ('SYS-CEO-001','SYS-QC-001') then 90 else 82 end,
case when s.system_key='SYS-VISION-001' then '["runway","openai","gemini","kie","kling","higgsfield","local"]'::jsonb
     when s.system_key in ('SYS-CEO-001','SYS-THELMA-001','SYS-QC-001') then '["openai","gemini","anthropic","deepseek","openrouter"]'::jsonb
     else '["openai","gemini","deepseek","anthropic","openrouter"]'::jsonb end,
'[]'::jsonb,
'Free/included/prepaid first only after rights, privacy, capability and quality gates. Runway is preferred for VisionWeaver and manual provider/model selection remains allowed.'
from public.analyst_system_index s
on conflict(organization_id,system_key) do update set
 free_included_first=true,manual_override_allowed=true,runway_preferred=excluded.runway_preferred,openai_project_preferred=excluded.openai_project_preferred,
 minimum_quality_score=excluded.minimum_quality_score,preferred_provider_order=excluded.preferred_provider_order,notes=excluded.notes,updated_at=now();

insert into public.model_catalog(model_name,provider,model_type,cost_per_unit,cost_unit,access_tier,best_for_tasks,is_active,routing_rank,last_verified_at,pricing_source_url,access_route,gateway_model_id)
values
 ('GPT-5.6 Sol','openai','text',4,'per_1m_input_tokens','paid','["complex_reasoning","architecture","high_value_review","coding"]'::jsonb,true,10,now(),'https://developers.openai.com/api/docs/models/gpt-5.6-sol','direct','gpt-5.6-sol'),
 ('GPT-5.6 Terra','openai','text',2,'per_1m_input_tokens','paid','["general_thelma","planning","professional_analysis"]'::jsonb,true,5,now(),'https://developers.openai.com/api/docs/models/gpt-5.6-terra','direct','gpt-5.6-terra'),
 ('GPT-5.6 Luna','openai','text',0.2,'per_1m_input_tokens','paid','["classification","routing","high_volume","wbc_triage"]'::jsonb,true,1,now(),'https://developers.openai.com/api/docs/models/gpt-5.6-luna','direct','gpt-5.6-luna')
on conflict do nothing;

insert into public.model_pricing_history(model_id,cost_per_unit,price_component,unit,currency,effective_at,source_url,verified_at,recorded_at,notes)
select id,4,'input','per_1m_tokens','USD',now(),'https://developers.openai.com/api/docs/models/gpt-5.6-sol',now(),now(),'Official OpenAI price verified 2026-08-27' from public.model_catalog where provider='openai' and model_name='GPT-5.6 Sol'
union all select id,20,'output','per_1m_tokens','USD',now(),'https://developers.openai.com/api/docs/models/gpt-5.6-sol',now(),now(),'Official OpenAI price verified 2026-08-27' from public.model_catalog where provider='openai' and model_name='GPT-5.6 Sol'
union all select id,2,'input','per_1m_tokens','USD',now(),'https://developers.openai.com/api/docs/models/gpt-5.6-terra',now(),now(),'Official OpenAI price verified 2026-08-27' from public.model_catalog where provider='openai' and model_name='GPT-5.6 Terra'
union all select id,12,'output','per_1m_tokens','USD',now(),'https://developers.openai.com/api/docs/models/gpt-5.6-terra',now(),now(),'Official OpenAI price verified 2026-08-27' from public.model_catalog where provider='openai' and model_name='GPT-5.6 Terra'
union all select id,0.2,'input','per_1m_tokens','USD',now(),'https://developers.openai.com/api/docs/models/gpt-5.6-luna',now(),now(),'Official OpenAI price verified 2026-08-27' from public.model_catalog where provider='openai' and model_name='GPT-5.6 Luna'
union all select id,1.2,'output','per_1m_tokens','USD',now(),'https://developers.openai.com/api/docs/models/gpt-5.6-luna',now(),now(),'Official OpenAI price verified 2026-08-27' from public.model_catalog where provider='openai' and model_name='GPT-5.6 Luna';

update public.model_catalog
set access_tier='paid',cost_per_unit=0.039,cost_unit='per_image',last_verified_at=now(),pricing_source_url='https://ai.google.dev/gemini-api/docs/pricing',
    best_for_tasks=(coalesce(best_for_tasks,'[]'::jsonb)-'free_tier_image_gen')||'["paid_image_generation"]'::jsonb,updated_at=now()
where provider='google' and model_name='Gemini 2.5 Flash Image';

select public.refresh_resource_daily_reports(id,current_date) from public.ceo_organizations;
