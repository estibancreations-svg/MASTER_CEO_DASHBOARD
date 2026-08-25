-- Applied live as 20260825173526_activate_white_blood_cell_monitor.
-- Converts active Analyst findings, Fabric dead letters and recent VisionWeaver failures into THELMA repair signals.
create or replace function public.refresh_white_blood_cells()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_findings integer:=0; v_resolved integer:=0; v_dead integer:=0; v_vision integer:=0;
begin
  insert into public.white_blood_cell_signals(organization_id,fingerprint,source_type,source_ref,system_key,severity,signal_type,title,summary,state,owner_agent,recommended_agent,repair_scope,evidence,last_seen_at,updated_at)
  select f.organization_id,'analyst:'||f.finding_key,'ANALYST_FINDING',f.finding_key,coalesce(f.system_key,'SYS-DASH-001'),f.severity,f.finding_type,f.title,f.description,
    case when f.status='BLOCKED' then 'BLOCKED' else 'OPEN' end,
    'THELMA',
    case when lower(f.domain) like '%security%' or lower(f.finding_type) like '%security%' then 'PERCY'
         when lower(f.finding_type) like '%evidence%' or lower(f.finding_type) like '%qc%' then 'VERITAS'
         when lower(f.finding_type) like '%memory%' then 'CANON_KEEPER'
         else 'WBC_ROOT_CAUSE' end,
    case when f.severity in ('critical','high') then 'APPROVAL_REQUIRED' else 'PROPOSE_ONLY' end,
    jsonb_build_object('finding_status',f.status,'priority',f.priority,'remediation_plan',f.remediation_plan,'source_ref',f.source_ref),now(),now()
  from public.analyst_findings f where f.status in ('OPEN','IN_PROGRESS','BLOCKED')
  on conflict (organization_id,fingerprint) do update set severity=excluded.severity,signal_type=excluded.signal_type,title=excluded.title,summary=excluded.summary,state=case when public.white_blood_cell_signals.state in ('REPAIRING','VERIFYING','AUTHORIZED') then public.white_blood_cell_signals.state else excluded.state end,recommended_agent=excluded.recommended_agent,repair_scope=excluded.repair_scope,evidence=excluded.evidence,last_seen_at=now(),updated_at=now();
  get diagnostics v_findings = row_count;

  update public.white_blood_cell_signals s set state='RESOLVED',resolved_at=coalesce(resolved_at,now()),updated_at=now()
  where s.source_type='ANALYST_FINDING' and s.state not in ('RESOLVED','SUPPRESSED') and exists(
    select 1 from public.analyst_findings f where f.organization_id=s.organization_id and 'analyst:'||f.finding_key=s.fingerprint and f.status in ('FIXED','VERIFIED','SUPERSEDED','NOT_APPLICABLE'));
  get diagnostics v_resolved = row_count;

  insert into public.white_blood_cell_signals(organization_id,fingerprint,source_type,source_ref,system_key,severity,signal_type,title,summary,state,owner_agent,recommended_agent,repair_scope,evidence,last_seen_at,updated_at)
  select d.organization_id,'deadletter:'||d.id::text,'FABRIC_DEAD_LETTER',d.id::text,'SYS-FABRIC-001','high','execution_failure','EC Fabric dead letter',d.reason,'OPEN','THELMA','WBC_RECOVERY','APPROVAL_REQUIRED',jsonb_build_object('job_id',d.job_id,'payload_snapshot',d.payload_snapshot),now(),now()
  from public.ec_dead_letters d where d.remediation_state not in ('resolved','ignored')
  on conflict (organization_id,fingerprint) do update set summary=excluded.summary,state='OPEN',last_seen_at=now(),updated_at=now(),evidence=excluded.evidence;
  get diagnostics v_dead = row_count;

  insert into public.white_blood_cell_signals(organization_id,fingerprint,source_type,source_ref,system_key,severity,signal_type,title,summary,state,owner_agent,recommended_agent,repair_scope,evidence,last_seen_at,updated_at)
  select p.organization_id,'vision-generation:'||g.id::text,'VISION_GENERATION',g.id::text,'SYS-VISION-001','medium','provider_or_generation_failure','VisionWeaver generation failed',coalesce(g.error,'Generation failed'),'OPEN','THELMA','WBC_ROOT_CAUSE','PROPOSE_ONLY',jsonb_build_object('project_id',g.project_id,'provider',g.provider,'model',g.model,'attempts',g.attempts),now(),now()
  from public.vw_generations g join public.vw_projects p on p.id=g.project_id
  where g.status::text='failed' and g.updated_at > now()-interval '30 days'
  on conflict (organization_id,fingerprint) do update set summary=excluded.summary,last_seen_at=now(),updated_at=now(),evidence=excluded.evidence;
  get diagnostics v_vision = row_count;

  return jsonb_build_object('findings_touched',v_findings,'resolved',v_resolved,'dead_letters_touched',v_dead,'vision_failures_touched',v_vision,'refreshed_at',now());
end $$;
revoke all on function public.refresh_white_blood_cells() from public;
grant execute on function public.refresh_white_blood_cells() to service_role;

do $$ begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    if not exists(select 1 from cron.job where jobname='thelma-white-blood-cells') then
      perform cron.schedule('thelma-white-blood-cells','*/5 * * * *','select public.refresh_white_blood_cells();');
    end if;
  end if;
end $$;
