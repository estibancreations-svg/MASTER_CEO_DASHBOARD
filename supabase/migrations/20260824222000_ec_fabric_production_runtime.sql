-- EC Integration Fabric production runtime
-- Mirrors the live Supabase production state certified on 2026-08-24.

create or replace function public.ec_queue_for_workflow(p_workflow_key text)
returns text language sql immutable set search_path=public as $$
select case
  when p_workflow_key like 'vision-%' then 'ec_vision'
  when p_workflow_key like '%health%' then 'ec_monitoring'
  when p_workflow_key like '%connector%' or p_workflow_key like '%sync%' then 'ec_connectors'
  when p_workflow_key like '%qc%' or p_workflow_key like '%review%' then 'ec_qc'
  when p_workflow_key like '%campaign%' or p_workflow_key like '%grant%' or p_workflow_key like '%land%' or p_workflow_key like '%agent%' then 'ec_agents'
  else 'ec_orchestration'
end;
$$;

create or replace function public.ec_enqueue_job(p_job_id uuid,p_queue_name text default null)
returns bigint language plpgsql security definer set search_path=public,pgmq as $$
declare j public.ec_integration_jobs%rowtype; q text; msg_id bigint; already_enqueued boolean;
begin
  select * into j from public.ec_integration_jobs where id=p_job_id for update;
  if not found then raise exception 'EC Fabric job not found: %',p_job_id; end if;
  if j.execution_state<>'queued' then raise exception 'Only queued jobs may be enqueued'; end if;
  if j.authorization_state<>'AUTHORIZED' then raise exception 'Job must be AUTHORIZED before enqueue'; end if;
  select exists(select 1 from public.ec_job_events where job_id=j.id and event_type='job.enqueued') into already_enqueued;
  if already_enqueued then return null; end if;
  q:=coalesce(p_queue_name,public.ec_queue_for_workflow(j.workflow_key));
  if q not in ('ec_orchestration','ec_vision','ec_agents','ec_connectors','ec_qc','ec_monitoring','ec_dead_letter') then raise exception 'Invalid EC queue: %',q; end if;
  select * into msg_id from pgmq.send(q,jsonb_build_object('job_id',j.id,'organization_id',j.organization_id,'correlation_id',j.correlation_id,'idempotency_key',j.idempotency_key,'module_key',j.module_key,'workflow_key',j.workflow_key,'target_connector',j.target_connector,'risk_level',j.risk_level,'payload',j.payload));
  insert into public.ec_job_events(organization_id,job_id,event_type,actor_type,actor_id,details) values(j.organization_id,j.id,'job.enqueued','system','ec-fabric',jsonb_build_object('queue',q,'message_id',msg_id));
  return msg_id;
end; $$;

create or replace function public.ec_enqueue_authorized_job_trigger()
returns trigger language plpgsql security definer set search_path=public,pgmq as $$
begin
  if new.execution_state='queued' and new.authorization_state='AUTHORIZED' and (tg_op='INSERT' or old.authorization_state is distinct from new.authorization_state or old.execution_state is distinct from new.execution_state) then
    perform public.ec_enqueue_job(new.id,null);
  end if;
  return new;
end; $$;

drop trigger if exists ec_enqueue_authorized_job on public.ec_integration_jobs;
create trigger ec_enqueue_authorized_job after insert or update on public.ec_integration_jobs for each row execute function public.ec_enqueue_authorized_job_trigger();

create or replace function public.ec_process_queue_once(p_queue_name text,p_visibility_timeout integer default 60)
returns jsonb language plpgsql security definer set search_path=public,pgmq as $$
declare m pgmq.message_record; j public.ec_integration_jobs%rowtype; outcome jsonb:='{}'::jsonb; downstream_id uuid; q text:=p_queue_name; retry_delay integer; err text;
begin
  if q not in ('ec_orchestration','ec_vision','ec_agents','ec_connectors','ec_qc','ec_monitoring','ec_dead_letter') then raise exception 'Invalid EC queue: %',q; end if;
  select * into m from pgmq.read(q,p_visibility_timeout,1,'{}'::jsonb) limit 1;
  if not found then return jsonb_build_object('ok',true,'queue',q,'processed',0); end if;
  select * into j from public.ec_integration_jobs where id=(m.message->>'job_id')::uuid for update;
  if not found then perform pgmq.archive(q,m.msg_id); return jsonb_build_object('ok',false,'error','job_not_found'); end if;
  if j.authorization_state<>'AUTHORIZED' then
    perform pgmq.archive(q,m.msg_id);
    insert into public.ec_job_events(organization_id,job_id,event_type,actor_type,actor_id,details) values(j.organization_id,j.id,'job.rejected','system','ec-fabric-worker',jsonb_build_object('reason','not_authorized','queue',q));
    return jsonb_build_object('ok',false,'job_id',j.id,'error','not_authorized');
  end if;
  begin
    if j.execution_state='queued' then update public.ec_integration_jobs set execution_state='claimed',updated_at=now() where id=j.id;
    elsif j.execution_state='retry_wait' and coalesce(j.next_attempt_at,now())<=now() then update public.ec_integration_jobs set execution_state='claimed',updated_at=now() where id=j.id;
    elsif j.execution_state not in ('claimed','running') then perform pgmq.archive(q,m.msg_id); return jsonb_build_object('ok',true,'job_id',j.id,'skipped',j.execution_state); end if;
    update public.ec_integration_jobs set execution_state='running',updated_at=now() where id=j.id and execution_state='claimed';
    if coalesce((j.payload->>'force_failure')::boolean,false) then raise exception 'Controlled certification failure'; end if;
    case j.workflow_key
      when 'system-health-pulse' then select jsonb_build_object('connectors',(select count(*) from public.ec_connectors),'active_connectors',(select count(*) from public.ec_connectors where connection_state='active'),'queued_jobs',(select count(*) from public.ec_integration_jobs where execution_state='queued'),'dead_letters',(select count(*) from public.ec_dead_letters where remediation_state='open'),'checked_at',now()) into outcome;
      when 'vision-production-intake' then
        if nullif(j.payload->>'project_title','') is null or nullif(j.payload->>'concept','') is null then raise exception 'Vision intake requires project_title and concept'; end if;
        insert into public.production_jobs(project_title,concept,scene_count,target_platform,owner_id,approval_state,provenance) values(j.payload->>'project_title',j.payload->>'concept',coalesce((j.payload->>'scene_count')::integer,2),coalesce(nullif(j.payload->>'target_platform',''),'YouTube'),j.requested_by,'approved',jsonb_build_object('ec_fabric_job_id',j.id,'correlation_id',j.correlation_id)) returning id into downstream_id;
        outcome:=jsonb_build_object('downstream','production_jobs','production_job_id',downstream_id);
      else outcome:=jsonb_build_object('accepted',true,'workflow',j.workflow_key,'module',j.module_key,'connector',j.target_connector,'processed_at',now());
    end case;
    insert into public.ec_job_events(organization_id,job_id,event_type,actor_type,actor_id,details) values(j.organization_id,j.id,'job.executed','system','ec-fabric-worker',outcome);
    update public.ec_integration_jobs set authorization_state='EXECUTED',updated_at=now() where id=j.id;
    update public.ec_integration_jobs set execution_state='completed',last_error=null,next_attempt_at=null,updated_at=now() where id=j.id;
    perform pgmq.archive(q,m.msg_id);
    return jsonb_build_object('ok',true,'queue',q,'processed',1,'job_id',j.id,'outcome',outcome);
  exception when others then
    err:=sqlerrm;
    select * into j from public.ec_integration_jobs where id=(m.message->>'job_id')::uuid for update;
    if j.execution_state='queued' then update public.ec_integration_jobs set execution_state='claimed',updated_at=now() where id=j.id; update public.ec_integration_jobs set execution_state='running',updated_at=now() where id=j.id;
    elsif j.execution_state='retry_wait' then update public.ec_integration_jobs set execution_state='claimed',updated_at=now() where id=j.id; update public.ec_integration_jobs set execution_state='running',updated_at=now() where id=j.id;
    elsif j.execution_state='claimed' then update public.ec_integration_jobs set execution_state='running',updated_at=now() where id=j.id; end if;
    select * into j from public.ec_integration_jobs where id=j.id;
    if j.retry_count+1<j.max_retries then
      retry_delay:=case j.retry_count when 0 then 10 when 1 then 30 else 120 end;
      update public.ec_integration_jobs set execution_state='retry_wait',retry_count=retry_count+1,last_error=err,next_attempt_at=now()+make_interval(secs=>retry_delay),updated_at=now() where id=j.id;
      perform pgmq.archive(q,m.msg_id); perform pgmq.send(q,m.message,retry_delay);
      return jsonb_build_object('ok',false,'queue',q,'job_id',j.id,'retry',j.retry_count+1,'error',err);
    else
      update public.ec_integration_jobs set retry_count=max_retries,last_error=err,execution_state='dead_letter',updated_at=now() where id=j.id;
      perform pgmq.archive(q,m.msg_id); perform pgmq.send('ec_dead_letter',m.message);
      return jsonb_build_object('ok',false,'queue',q,'job_id',j.id,'dead_letter',true,'error',err);
    end if;
  end;
end; $$;

create or replace view public.ec_fabric_health as
select now() observed_at,
 (select count(*) from public.ec_integration_jobs where execution_state='queued') queued_jobs,
 (select count(*) from public.ec_integration_jobs where execution_state='running') running_jobs,
 (select count(*) from public.ec_integration_jobs where execution_state='retry_wait') retrying_jobs,
 (select count(*) from public.ec_integration_jobs where execution_state='dead_letter') dead_letter_jobs,
 (select count(*) from public.ec_integration_jobs where execution_state='completed') completed_jobs,
 (select count(*) from public.ec_connectors where connection_state='active') active_connectors,
 (select count(*) from public.ec_connectors) total_connectors;

revoke all on function public.ec_queue_for_workflow(text) from public,anon,authenticated;
revoke all on function public.ec_enqueue_job(uuid,text) from public,anon,authenticated;
revoke all on function public.ec_enqueue_authorized_job_trigger() from public,anon,authenticated;
revoke all on function public.ec_process_queue_once(text,integer) from public,anon,authenticated;
grant execute on function public.ec_queue_for_workflow(text) to service_role;
grant execute on function public.ec_enqueue_job(uuid,text) to service_role;
grant execute on function public.ec_process_queue_once(text,integer) to service_role;
revoke all on public.ec_fabric_health from anon;
grant select on public.ec_fabric_health to authenticated,service_role;

select cron.unschedule(jobid) from cron.job where jobname like 'ec-fabric-%';
select cron.schedule('ec-fabric-orchestration','* * * * *',$$select public.ec_process_queue_once('ec_orchestration',60);$$);
select cron.schedule('ec-fabric-vision','* * * * *',$$select public.ec_process_queue_once('ec_vision',60);$$);
select cron.schedule('ec-fabric-agents','* * * * *',$$select public.ec_process_queue_once('ec_agents',60);$$);
select cron.schedule('ec-fabric-connectors','* * * * *',$$select public.ec_process_queue_once('ec_connectors',60);$$);
select cron.schedule('ec-fabric-qc','* * * * *',$$select public.ec_process_queue_once('ec_qc',60);$$);
select cron.schedule('ec-fabric-monitoring','* * * * *',$$select public.ec_process_queue_once('ec_monitoring',60);$$);