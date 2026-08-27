create or replace function public.estimate_text_model_cost_usd(
  p_provider text,p_model_id text,p_input_tokens bigint,p_output_tokens bigint
) returns numeric language plpgsql stable security definer set search_path=public as $$
declare v_model uuid; v_in numeric:=0; v_out numeric:=0;
begin
  select id into v_model from public.model_catalog
   where provider=p_provider and (gateway_model_id=p_model_id or lower(model_name)=lower(p_model_id))
   order by last_verified_at desc nulls last limit 1;
  if v_model is null then return 0; end if;
  select coalesce(
    (select cost_per_unit from public.model_pricing_history where model_id=v_model and price_component='input' order by coalesce(effective_at,recorded_at) desc limit 1),
    (select cost_per_unit from public.model_catalog where id=v_model),0
  ) into v_in;
  select coalesce(
    (select cost_per_unit from public.model_pricing_history where model_id=v_model and price_component='output' order by coalesce(effective_at,recorded_at) desc limit 1),0
  ) into v_out;
  return round(coalesce(p_input_tokens,0)::numeric/1000000*v_in + coalesce(p_output_tokens,0)::numeric/1000000*v_out,8);
end $$;

create or replace function public.record_model_resource_usage(
  p_organization_id uuid,p_system_key text,p_provider_key text,p_model_id text,p_task_class text,p_project_key text,p_user_id uuid,
  p_input_tokens bigint,p_output_tokens bigint,p_source_event_ref text,p_evidence jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_cost numeric;
begin
  v_cost:=public.estimate_text_model_cost_usd(p_provider_key,p_model_id,p_input_tokens,p_output_tokens);
  return public.record_resource_usage(
    p_organization_id,p_system_key,p_provider_key,p_model_id,p_task_class,p_project_key,null,p_user_id,null,'tokens',
    p_input_tokens,p_output_tokens,null,v_cost,0,'SYSTEM',p_source_event_ref,
    coalesce(p_evidence,'{}'::jsonb)||jsonb_build_object('estimated_cost_usd',v_cost)
  );
end $$;
