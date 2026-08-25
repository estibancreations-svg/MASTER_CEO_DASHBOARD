-- Applied live as 20260825174016_remove_fabric_generic_false_success.
-- Only registered workflow handlers may reach EXECUTED/completed. Unsupported work throws and enters retry/dead-letter evidence.
create or replace function public.ec_process_queue_once(p_queue_name text, p_visibility_timeout integer default 60)
returns jsonb language plpgsql security definer set search_path='public','pgmq' as $$
declare
  m pgmq.message_record; j public.ec_integration_jobs%rowtype; outcome jsonb := '{}'::jsonb; downstream_id uuid; q text := p_queue_name; retry_delay integer; err text;
begin
  if q not in ('ec_orchestration','ec_vision','ec_agents','ec_connectors','ec_qc','ec_monitoring','ec_dead_letter') then raise exception 'Invalid EC queue: %',q; end if;
  select * into m from pgmq.read(q,p_visibility_timeout,1,'{}'::jsonb) limit 1;
  if not found then return jsonb_build_object('ok',true,'queue',q,'processed',0); end if;
  select * into j from public.ec_integration_jobs where id=(m.message->>'job_id')::uuid for update;
  if not found then perform pgmq.archive(q,m.msg_id); return jsonb_build_object('ok',false,'error','job_not_found'); end if;
  if j.authorization_state <> 'AUTHORIZED' then
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
      when 'system-health-pulse' then
        select jsonb_build_object('connectors',(select count(*) from public.ec_connectors),'active_connectors',(select count(*) from public.ec_connectors where connection_state='active'),'queued_jobs',(select count(*) from public.ec_integration_jobs where execution_state='queued'),'dead_letters',(select count(*) from public.ec_dead_letters where remediation_state='open'),'checked_at',now()) into outcome;
      when 'vision-production-intake' then
        if nullif(j.payload->>'project_title','') is null or nullif(j.payload->>'concept','') is null then raise exception 'Vision intake requires project_title and concept'; end if;
        insert into public.production_jobs(project_title,concept,scene_count,target_platform,owner_id,approval_state,provenance)
        values(j.payload->>'project_title',j.payload->>'concept',coalesce((j.payload->>'scene_count')::integer,2),coalesce(nullif(j.payload->>'target_platform',''),'YouTube'),j.requested_by,'approved',jsonb_build_object('ec_fabric_job_id',j.id,'correlation_id',j.correlation_id)) returning id into downstream_id;
        outcome:=jsonb_build_object('downstream','production_jobs','production_job_id',downstream_id,'handler','vision-production-intake');
      when 'agent-command-dispatch' then raise exception 'Legacy agent-command-dispatch has no certified executor. Use the authenticated THELMA AI runtime and White Blood Cell repair plans.';
      else raise exception 'No registered EC Fabric workflow handler: %',j.workflow_key;
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
    if j.retry_count+1 < j.max_retries then
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
end $$;
update public.analyst_findings set status='FIXED',corrected_at=now(),current_state='Generic Fabric fallback removed; unsupported workflows now fail with explicit handler-missing evidence.',updated_at=now() where finding_key='FALSE-SUCCESS-FABRIC-GENERIC' and status in ('OPEN','IN_PROGRESS');
