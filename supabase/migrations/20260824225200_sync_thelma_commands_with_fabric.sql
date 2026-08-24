create or replace function public.ec_sync_orchestration_command_from_job()
returns trigger
language plpgsql
security definer
set search_path='public'
as $$
declare
  command_id uuid;
begin
  if new.payload ? 'command_id' then
    begin
      command_id := (new.payload->>'command_id')::uuid;
    exception when others then
      command_id := null;
    end;

    if command_id is not null then
      if new.execution_state='completed' then
        update public.orchestration_commands
        set execution_status='completed',
            authorization_state='EXECUTED',
            result_reference=jsonb_build_object('fabric_job_id',new.id,'completed_at',now()),
            updated_at=now()
        where id=command_id;
      elsif new.execution_state='dead_letter' then
        update public.orchestration_commands
        set execution_status='failed',
            authorization_state='FAILED',
            result_reference=jsonb_build_object('fabric_job_id',new.id,'error',new.last_error),
            updated_at=now()
        where id=command_id;
      elsif new.execution_state='cancelled' then
        update public.orchestration_commands
        set execution_status='cancelled',
            updated_at=now()
        where id=command_id;
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ec_sync_orchestration_command on public.ec_integration_jobs;
create trigger trg_ec_sync_orchestration_command
after update of execution_state on public.ec_integration_jobs
for each row
when (old.execution_state is distinct from new.execution_state)
execute function public.ec_sync_orchestration_command_from_job();
