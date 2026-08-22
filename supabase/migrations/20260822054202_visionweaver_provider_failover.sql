-- Keep exactly one VisionWeaver scheduler active. The legacy orchestrator and
-- the Studio worker were both running every minute and racing over production state.
do $$
begin
  if exists (
    select 1 from cron.job
    where jobname = 'visionweaver-orchestrator-tick'
  ) then
    perform cron.unschedule('visionweaver-orchestrator-tick');
  end if;
end
$$;

insert into public.system_settings (key, value)
values
  ('kling_image_model', '"kling-v2"'::jsonb),
  ('kling_video_model', '"kling-v2-6"'::jsonb)
on conflict (key) do nothing;
