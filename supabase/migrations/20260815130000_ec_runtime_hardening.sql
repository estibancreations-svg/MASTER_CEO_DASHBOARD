-- Provider-independent EC Integration Fabric runtime hardening.
-- The live project received this final state through three reviewed migrations on 2026-08-15.

create or replace function public.ec_validate_job_transition()
returns trigger language plpgsql set search_path = public as $$
declare
  allowed boolean := false;
  is_human_reset boolean := old.execution_state = 'dead_letter' and new.execution_state = 'queued';
begin
  if new.organization_id <> old.organization_id
     or new.idempotency_key <> old.idempotency_key
     or new.correlation_id <> old.correlation_id then
    raise exception 'Immutable job identity fields cannot be changed';
  end if;
  if (not is_human_reset and new.retry_count < old.retry_count)
     or new.retry_count > new.max_retries then
    raise exception 'Invalid retry count';
  end if;
  if new.execution_state = old.execution_state then return new; end if;

  allowed := case old.execution_state
    when 'queued' then new.execution_state in ('claimed','cancelled')
    when 'claimed' then new.execution_state in ('running','retry_wait','cancelled')
    when 'running' then new.execution_state in ('completed','retry_wait','dead_letter','cancelled')
    when 'retry_wait' then new.execution_state in ('claimed','dead_letter','cancelled')
    when 'dead_letter' then new.execution_state in ('queued','cancelled')
    else false
  end;
  if not allowed then
    raise exception 'Invalid EC job transition: % -> %', old.execution_state, new.execution_state;
  end if;
  if new.execution_state in ('claimed','running')
     and new.authorization_state not in ('AUTHORIZED','EXECUTED') then
    raise exception 'Execution requires authorization';
  end if;
  if new.execution_state = 'retry_wait' and (
       new.retry_count <> old.retry_count + 1
       or new.last_error is null
       or new.next_attempt_at is null
       or new.retry_count >= new.max_retries) then
    raise exception 'Retry wait requires an incremented retry, error, future attempt, and remaining retry capacity';
  end if;
  if new.execution_state = 'dead_letter' then
    if new.retry_count < new.max_retries or new.last_error is null then
      raise exception 'Dead letter requires exhausted retries and an error';
    end if;
    new.authorization_state := 'FAILED';
  end if;
  if is_human_reset then
    if new.retry_count <> 0 or new.authorization_state <> 'ASK' then
      raise exception 'Human override must reset retries and return authorization to ASK';
    end if;
    new.last_error := null;
    new.next_attempt_at := null;
  end if;
  if new.execution_state = 'completed' then
    if new.authorization_state <> 'EXECUTED' then
      raise exception 'Completion requires EXECUTED authorization state';
    end if;
    new.last_error := null;
    new.next_attempt_at := null;
  end if;
  return new;
end;
$$;

create or replace function public.ec_append_job_event()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  if tg_op = 'INSERT' then
    insert into public.ec_job_events(organization_id,job_id,event_type,actor_type,actor_id,details)
    values(new.organization_id,new.id,'job.created',
      case when auth.uid() is null then 'system' else 'user' end,
      coalesce(auth.uid()::text,current_user),
      jsonb_build_object('execution_state',new.execution_state,'authorization_state',new.authorization_state,'risk_level',new.risk_level));
  elsif new.execution_state is distinct from old.execution_state
     or new.authorization_state is distinct from old.authorization_state
     or new.retry_count is distinct from old.retry_count then
    insert into public.ec_job_events(organization_id,job_id,event_type,actor_type,actor_id,details)
    values(new.organization_id,new.id,'job.transitioned',
      case when auth.uid() is null then 'system' else 'user' end,
      coalesce(auth.uid()::text,current_user),
      jsonb_build_object('from_execution_state',old.execution_state,'to_execution_state',new.execution_state,
        'from_authorization_state',old.authorization_state,'to_authorization_state',new.authorization_state,
        'retry_count',new.retry_count,'last_error',new.last_error,'next_attempt_at',new.next_attempt_at));
    if new.execution_state = 'dead_letter' then
      insert into public.ec_dead_letters(organization_id,job_id,reason,payload_snapshot,remediation_state)
      values(new.organization_id,new.id,new.last_error,new.payload,'open')
      on conflict (job_id) do update set reason=excluded.reason,payload_snapshot=excluded.payload_snapshot,
        remediation_state='open',resolved_at=null;
    elsif old.execution_state = 'dead_letter' and new.execution_state = 'queued' then
      update public.ec_dead_letters set remediation_state='requeued',resolved_at=now() where job_id=new.id;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.block_immutable_history_change()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception '% is append-only', tg_table_name;
end;
$$;

drop trigger if exists ec_validate_job_transition_trigger on public.ec_integration_jobs;
create trigger ec_validate_job_transition_trigger before update on public.ec_integration_jobs
for each row execute function public.ec_validate_job_transition();
drop trigger if exists ec_append_job_event_trigger on public.ec_integration_jobs;
create trigger ec_append_job_event_trigger after insert or update on public.ec_integration_jobs
for each row execute function public.ec_append_job_event();
drop trigger if exists ec_job_events_immutable_trigger on public.ec_job_events;
create trigger ec_job_events_immutable_trigger before update or delete on public.ec_job_events
for each row execute function public.block_immutable_history_change();
drop trigger if exists ceo_audit_events_immutable_trigger on public.ceo_audit_events;
create trigger ceo_audit_events_immutable_trigger before update or delete on public.ceo_audit_events
for each row execute function public.block_immutable_history_change();

revoke all on function public.ec_validate_job_transition() from public, anon, authenticated;
revoke all on function public.ec_append_job_event() from public, anon, authenticated;
revoke all on function public.block_immutable_history_change() from public, anon, authenticated;
