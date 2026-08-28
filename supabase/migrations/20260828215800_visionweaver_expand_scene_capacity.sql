-- Align VisionWeaver production_jobs capacity with the long-form orchestrator.
-- 120 sequential 30-second segments permits up to 60 minutes for governed project workflows,
-- while the Studio UI currently exposes up to 10 minutes per request.
alter table public.production_jobs
  drop constraint if exists production_jobs_scene_count_check;

alter table public.production_jobs
  add constraint production_jobs_scene_count_check
  check (scene_count >= 1 and scene_count <= 120);
