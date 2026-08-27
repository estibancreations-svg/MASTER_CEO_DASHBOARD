create or replace function public.bridge_thelma_message_resource_usage() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.role='assistant' and new.model_provider is not null and (new.input_tokens is not null or new.output_tokens is not null) then
    perform public.record_model_resource_usage(
      new.organization_id,'SYS-THELMA-001',lower(new.model_provider),coalesce(new.model_id,'unknown'),'thelma_chat',new.conversation_id::text,null,
      new.input_tokens,new.output_tokens,'thelma_message:'||new.id::text,
      jsonb_build_object('message_id',new.id,'conversation_id',new.conversation_id,'agent_key',new.agent_key)
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_thelma_message_resource_usage on public.thelma_messages;
create trigger trg_thelma_message_resource_usage
after insert or update of input_tokens,output_tokens,model_provider,model_id on public.thelma_messages
for each row execute function public.bridge_thelma_message_resource_usage();

create or replace function public.bridge_vw_generation_resource_usage() returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_org uuid; v_cost numeric:=0; v_credits numeric:=null; v_quantity numeric:=null; v_unit text:=null;
  v_catalog record; v_output_count numeric:=1;
begin
  if new.status::text<>'complete' then return new; end if;
  select organization_id into v_org from public.vw_projects where id=new.project_id;
  if v_org is null then return new; end if;
  if jsonb_typeof(new.result->'output_count')='number' then v_output_count=(new.result->>'output_count')::numeric; end if;
  select * into v_catalog from public.model_catalog
   where is_active=true and lower(provider)=lower(split_part(new.provider,'+',1))
   and (lower(coalesce(gateway_model_id,''))=lower(new.model) or lower(model_name)=lower(new.model)
        or lower(model_name) like '%'||replace(replace(lower(new.model),'gen','gen-'),'_','-')||'%'
        or (lower(new.model)='gen4.5' and lower(model_name) like '%gen-4.5%'))
   order by routing_rank,last_verified_at desc nulls last limit 1;
  if found then
    if v_catalog.cost_unit='per_second' and new.parameters ? 'duration' then
      v_quantity=(new.parameters->>'duration')::numeric; v_unit='seconds'; v_cost=coalesce(v_catalog.cost_per_unit,0)*v_quantity;
    elsif v_catalog.cost_unit='per_image' then
      v_quantity=greatest(v_output_count,1); v_unit='images'; v_cost=coalesce(v_catalog.cost_per_unit,0)*v_quantity;
    elsif v_catalog.cost_unit='per_request' then
      v_quantity=1; v_unit='request'; v_cost=coalesce(v_catalog.cost_per_unit,0);
    end if;
  end if;
  if lower(split_part(new.provider,'+',1))='runway' and v_cost>0 then v_credits=v_cost/0.01; end if;
  insert into public.resource_usage_events(
    organization_id,occurred_at,system_key,project_key,job_key,user_id,resource_account_id,provider_key,model_id,task_class,modality,
    quantity,unit,provider_credits,cost_usd,source_type,source_event_ref,evidence
  )
  select v_org,coalesce(new.completed_at,new.updated_at,now()),'SYS-VISION-001',new.project_id::text,new.id::text,new.owner_id,ra.id,
    lower(split_part(new.provider,'+',1)),new.model,new.operation,new.media_type,v_quantity,v_unit,v_credits,v_cost,'SYSTEM','vw_generation:'||new.id::text,
    jsonb_build_object('generation_id',new.id,'provider',new.provider,'model',new.model,'status',new.status::text,
      'cost_basis',case when found then jsonb_build_object('catalog_model',v_catalog.model_name,'cost_per_unit',v_catalog.cost_per_unit,'cost_unit',v_catalog.cost_unit) else jsonb_build_object('unpriced',true) end)
  from (select 1) x
  left join lateral (
    select id from public.resource_accounts where organization_id=v_org and provider_key=lower(split_part(new.provider,'+',1)) order by preferred_rank limit 1
  ) ra on true
  on conflict (organization_id,provider_key,source_event_ref) where source_event_ref is not null
  do update set cost_usd=excluded.cost_usd,provider_credits=excluded.provider_credits,evidence=public.resource_usage_events.evidence||excluded.evidence;
  return new;
end $$;

drop trigger if exists trg_vw_generation_resource_usage on public.vw_generations;
create trigger trg_vw_generation_resource_usage
after insert or update of status,result,parameters,completed_at on public.vw_generations
for each row execute function public.bridge_vw_generation_resource_usage();

create or replace function public.bridge_orchestration_run_resource_usage() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.usage_cost is not null and new.usage_cost<>0 and new.status in ('succeeded','failed') then
    insert into public.resource_usage_events(
      organization_id,occurred_at,system_key,job_key,provider_key,model_id,task_class,quantity,unit,cost_usd,source_type,source_event_ref,evidence
    ) values(
      new.organization_id,coalesce(new.completed_at,new.created_at,now()),'SYS-FABRIC-001',new.id::text,'ec-fabric',new.engine,new.workflow_key,1,'run',new.usage_cost,
      'SYSTEM','orchestration_run:'||new.id::text,jsonb_build_object('run_id',new.id,'command_id',new.command_id,'engine',new.engine,'trigger_type',new.trigger_type,'status',new.status)
    ) on conflict (organization_id,provider_key,source_event_ref) where source_event_ref is not null
    do update set cost_usd=excluded.cost_usd,evidence=public.resource_usage_events.evidence||excluded.evidence;
  end if;
  return new;
end $$;

drop trigger if exists trg_orchestration_run_resource_usage on public.orchestration_runs;
create trigger trg_orchestration_run_resource_usage
after insert or update of usage_cost,status,completed_at on public.orchestration_runs
for each row execute function public.bridge_orchestration_run_resource_usage();

insert into public.resource_usage_events(
  organization_id,occurred_at,system_key,project_key,job_key,user_id,provider_key,model_id,task_class,modality,
  quantity,unit,provider_credits,cost_usd,source_type,source_event_ref,evidence
)
select p.organization_id,coalesce(g.completed_at,g.updated_at,g.created_at),'SYS-VISION-001',g.project_id::text,g.id::text,g.owner_id,
 lower(split_part(g.provider,'+',1)),g.model,g.operation,g.media_type,
 case when mc.cost_unit='per_second' and g.parameters?'duration' then (g.parameters->>'duration')::numeric
      when mc.cost_unit='per_image' then coalesce((g.result->>'output_count')::numeric,1) else null end,
 case when mc.cost_unit='per_second' then 'seconds' when mc.cost_unit='per_image' then 'images' when mc.cost_unit='per_request' then 'request' else null end,
 case when lower(split_part(g.provider,'+',1))='runway' and mc.cost_unit='per_second' and g.parameters?'duration' then mc.cost_per_unit*(g.parameters->>'duration')::numeric/0.01 else null end,
 case when mc.cost_unit='per_second' and g.parameters?'duration' then mc.cost_per_unit*(g.parameters->>'duration')::numeric
      when mc.cost_unit='per_image' then mc.cost_per_unit*coalesce((g.result->>'output_count')::numeric,1)
      when mc.cost_unit='per_request' then mc.cost_per_unit else 0 end,
 'SYSTEM','vw_generation:'||g.id::text,
 jsonb_build_object('backfilled',true,'generation_id',g.id,'provider',g.provider,'model',g.model,'catalog_model',mc.model_name)
from public.vw_generations g
join public.vw_projects p on p.id=g.project_id
left join lateral (
  select * from public.model_catalog x where x.is_active=true and lower(x.provider)=lower(split_part(g.provider,'+',1))
  and (lower(coalesce(x.gateway_model_id,''))=lower(g.model) or lower(x.model_name)=lower(g.model) or (lower(g.model)='gen4.5' and lower(x.model_name) like '%gen-4.5%'))
  order by x.routing_rank,x.last_verified_at desc nulls last limit 1
) mc on true
where g.status::text='complete'
on conflict (organization_id,provider_key,source_event_ref) where source_event_ref is not null do nothing;

select public.refresh_resource_daily_reports(id,current_date) from public.ceo_organizations;
