do $$
declare v_org uuid;
begin
  select id into v_org from public.ceo_organizations where slug='estiban-creations' limit 1;
  if v_org is null then raise exception 'estiban-creations organization not found'; end if;

  update public.ceo_integrations
     set required_secrets=array['GEMINI_CONNECTION']::text[],
         status='staged',
         last_health_at=now(),
         provenance=coalesce(provenance,'{}'::jsonb)||jsonb_build_object(
           'credential_state','VALID','generation_state','BILLING_OR_QUOTA_REQUIRED','tested_model','gemini-3.6-flash',
           'tested_at',now(),'canonical_secret','GEMINI_CONNECTION'
         ),
         updated_at=now()
   where organization_id=v_org and integration_key='google-gemini';

  update public.resource_accounts
     set status='STAGED', balance_confidence='LOW', last_synced_at=now(), last_verified_at=now(),
         metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
           'credential','GEMINI_CONNECTION','credential_state','VALID','models_status',200,'generation_status',429,
           'generation_state','BILLING_OR_QUOTA_REQUIRED','tested_model','gemini-3.6-flash','tested_at',now(),
           'note','Gemini credential is valid; API generation is blocked until prepayment/billing is restored.'
         )
   where organization_id=v_org and provider_key='gemini';

  insert into public.system_settings(key,value)
  values ('thelma_gemini_model',to_jsonb('gemini-3.6-flash'::text)),
         ('thelma_provider_order',to_jsonb('openai,gemini,anthropic,openrouter'::text))
  on conflict(key) do update set value=excluded.value,updated_at=now();

  insert into public.thelma_plugin_registry(
    organization_id,plugin_key,display_name,provider,capability_class,integration_mode,transport,auth_strategy,connection_state,
    approval_policy,allowed_operations,prohibited_operations,credential_ref_name,endpoint,owner_agent,last_verified_at,notes,metadata
  ) values (
    v_org,'gemini-models','Google Gemini','Google','reasoning + multimodal + image/video analysis',
    'Gemini API / Interactions-compatible adapter','HTTPS','api_key','BLOCKED','ALWAYS_FOR_WRITE',
    array['reason','analyze multimodal','compare','draft','verify']::text[],
    array['production generation while billing blocked','unapproved external write']::text[],
    'GEMINI_CONNECTION','https://generativelanguage.googleapis.com','THELMA',now(),
    'Credential tested successfully. Model discovery works. Minimal generation using gemini-3.6-flash returned 429 RESOURCE_EXHAUSTED because prepayment credits are depleted. Activate billing before MODEL_ACTIVE.',
    jsonb_build_object('credential_state','VALID','generation_state','BILLING_OR_QUOTA_REQUIRED','tested_model','gemini-3.6-flash','models_status',200,'generation_status',429)
  )
  on conflict(organization_id,plugin_key) do update set
    credential_ref_name=excluded.credential_ref_name,
    connection_state=excluded.connection_state,
    last_verified_at=excluded.last_verified_at,
    notes=excluded.notes,
    metadata=excluded.metadata,
    updated_at=now();

  insert into public.analyst_memory(organization_id,memory_key,system_key,category,title,summary,body,memory_state,trust_level,source_ref,provenance,tags,effective_at)
  values(
    v_org,'GEMINI-CONNECTION-CANONICAL','SYS-THELMA-001','credential_governance','Gemini canonical connection and billing state',
    'GEMINI_CONNECTION is the canonical Gemini credential. The credential was accepted by Google; generation remains billing/quota blocked.',
    'Use GEMINI_CONNECTION for active Gemini integrations. On 2026-08-27 Google model discovery returned HTTP 200. gemini-2.5-flash returned a model-drift message directing new users to gemini-3.6-flash. A follow-up minimal generation test against gemini-3.6-flash returned HTTP 429 RESOURCE_EXHAUSTED stating prepayment credits are depleted. Treat Gemini as CONNECTED / BILLING REQUIRED until a generation health check succeeds. Do not interpret the 429 as a bad credential.',
    'ACTIVE_CANON','VERIFIED','gemini-connection-test',
    jsonb_build_object('models_status',200,'tested_model','gemini-3.6-flash','generation_status',429,'credential_name','GEMINI_CONNECTION'),
    array['gemini','credentials','billing','model-drift','thelma']::text[],now()
  )
  on conflict(organization_id,memory_key) do update set
    summary=excluded.summary,body=excluded.body,memory_state='ACTIVE_CANON',trust_level='VERIFIED',source_ref=excluded.source_ref,
    provenance=excluded.provenance,tags=excluded.tags,effective_at=excluded.effective_at,updated_at=now();

  update public.ecosystem_watch_sources set system_key='SYS-CMGIO-001', cadence='monday_thursday'
   where organization_id=v_org and source_key='MARKETING-AGENTS';
  update public.ecosystem_watch_sources set cadence='monday_thursday' where organization_id=v_org;

  insert into public.ecosystem_watch_sources(organization_id,source_key,system_key,query_family,search_query,source_kind,enabled,minimum_score,cadence)
  values
   (v_org,'ADS-PLATFORMS','SYS-ADS-001','advertising production intelligence','AI advertising creative optimization open source ads automation stars:>50','github',true,60,'monday_thursday'),
   (v_org,'AGENCY-OPERATIONS','SYS-AGENCYFLOW-001','agency operations','AI agency automation CRM social agents open source stars:>50','github',true,60,'monday_thursday'),
   (v_org,'ASSESSMENT-INTELLIGENCE','SYS-ASSESS-001','assessment intelligence','open source assessment psychometrics survey AI platform stars:>20','github',true,55,'monday_thursday'),
   (v_org,'CEO-DECISION-SYSTEMS','SYS-CEO-001','executive decision systems','AI executive dashboard decision support agent command center stars:>20','github',true,55,'monday_thursday'),
   (v_org,'CLIMATE-INTELLIGENCE','SYS-CLIMATE-001','climate intelligence','open source climate sustainability carbon intelligence platform stars:>50','github',true,60,'monday_thursday'),
   (v_org,'CMGIO-GROWTH','SYS-CMGIO-001','growth intelligence','marketing growth intelligence social automation AI agents stars:>50','github',true,60,'monday_thursday'),
   (v_org,'DASHBOARD-OS','SYS-DASH-001','operating dashboards','executive dashboard design system AI command center stars:>50','github',true,60,'monday_thursday'),
   (v_org,'FABRIC-ORCHESTRATION','SYS-FABRIC-001','durable execution','durable workflow orchestration queue retry dead letter TypeScript stars:>100','github',true,65,'monday_thursday'),
   (v_org,'GRANT-INTELLIGENCE','SYS-GRANT-001','grant intelligence','grant RFP proposal management AI open source stars:>20','github',true,55,'monday_thursday'),
   (v_org,'IAM-SELF-SERVICE','SYS-IAM-001','identity access','identity access management self service zero trust open source stars:>100','github',true,65,'monday_thursday'),
   (v_org,'LAND-GIS','SYS-LAND-001','land property GIS','GIS parcel property land intelligence open source stars:>50','github',true,60,'monday_thursday'),
   (v_org,'PUBLISHING-MEDIA','SYS-PUBLISH-001','publishing media','book publishing audiobook multimedia AI open source stars:>20','github',true,55,'monday_thursday'),
   (v_org,'QC-EVALS','SYS-QC-001','quality evaluation','AI evals agent observability regression testing quality assurance stars:>50','github',true,60,'monday_thursday'),
   (v_org,'TELECOM-AI','SYS-TELECOM-001','telecommunications','SIP call center voice AI telecom open source stars:>50','github',true,60,'monday_thursday'),
   (v_org,'THELMA-ORCHESTRATION','SYS-THELMA-001','agent orchestration','multi agent orchestration memory repair governance framework stars:>100','github',true,65,'monday_thursday'),
   (v_org,'TRAINING-LMS','SYS-TRAINING-001','AI learning systems','LMS AI tutoring certification open source stars:>50','github',true,60,'monday_thursday'),
   (v_org,'VISION-PRODUCTION','SYS-VISION-001','creative production','AI image video audio music creative production workflow stars:>100','github',true,65,'monday_thursday')
  on conflict(organization_id,source_key) do update set
    system_key=excluded.system_key,query_family=excluded.query_family,search_query=excluded.search_query,source_kind=excluded.source_kind,
    enabled=excluded.enabled,minimum_score=excluded.minimum_score,cadence=excluded.cadence,updated_at=now();

  perform cron.alter_job(14,'0 13 * * 1,4',null,null,null,true);
end $$;
