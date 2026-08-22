-- VisionWeaver durable multimodal execution core.
do $$ begin
  create type public.vw_generation_status as enum ('queued','submitting','processing','complete','failed','cancelled');
exception when duplicate_object then null;
end $$;

alter table public.vw_projects add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.vw_projects add column if not exists organization_id uuid;
alter table public.vw_projects add column if not exists medium text;
alter table public.vw_projects add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.vw_projects add column if not exists outputs jsonb not null default '{}'::jsonb;
alter table public.vw_projects add column if not exists error text;

create table if not exists public.vw_generations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.vw_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null check (media_type in ('image','video','audio','book','movie')),
  operation text not null default 'generate',
  provider text not null,
  model text not null,
  prompt text not null,
  parameters jsonb not null default '{}'::jsonb,
  status public.vw_generation_status not null default 'queued',
  external_id text,
  output_urls text[] not null default '{}',
  storage_paths text[] not null default '{}',
  result jsonb not null default '{}'::jsonb,
  error text,
  attempts integer not null default 0,
  poll_count integer not null default 0,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.vw_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.vw_projects(id) on delete cascade,
  generation_id uuid references public.vw_generations(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('image','video','audio','document','book','movie')),
  title text not null,
  storage_path text,
  source_url text,
  mime_type text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists vw_projects_owner_created_idx on public.vw_projects(owner_id,created_at desc);
create index if not exists vw_generations_owner_created_idx on public.vw_generations(owner_id,created_at desc);
create index if not exists vw_generations_status_idx on public.vw_generations(status,created_at);
create index if not exists vw_generations_project_idx on public.vw_generations(project_id,created_at desc);
create index if not exists vw_assets_owner_created_idx on public.vw_assets(owner_id,created_at desc);

create or replace function public.vw_touch_updated_at() returns trigger
language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end $$;
drop trigger if exists vw_projects_touch on public.vw_projects;
create trigger vw_projects_touch before update on public.vw_projects for each row execute function public.vw_touch_updated_at();
drop trigger if exists vw_generations_touch on public.vw_generations;
create trigger vw_generations_touch before update on public.vw_generations for each row execute function public.vw_touch_updated_at();

alter table public.vw_generations enable row level security;
alter table public.vw_assets enable row level security;
drop policy if exists "visionweaver owner access" on public.vw_projects;
create policy "visionweaver owner access" on public.vw_projects for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
drop policy if exists "visionweaver generation owner access" on public.vw_generations;
create policy "visionweaver generation owner access" on public.vw_generations for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
drop policy if exists "visionweaver asset owner access" on public.vw_assets;
create policy "visionweaver asset owner access" on public.vw_assets for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
grant select,insert,update,delete on public.vw_projects,public.vw_generations,public.vw_assets to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('visionweaver-outputs','visionweaver-outputs',false,104857600,array['image/png','image/jpeg','image/webp','video/mp4','audio/mpeg','audio/wav','text/markdown','application/json'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "owners read visionweaver outputs" on storage.objects;
create policy "owners read visionweaver outputs" on storage.objects for select to authenticated using(bucket_id='visionweaver-outputs' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "owners upload visionweaver outputs" on storage.objects;
create policy "owners upload visionweaver outputs" on storage.objects for insert to authenticated with check(bucket_id='visionweaver-outputs' and (storage.foldername(name))[1]=(select auth.uid())::text);

update public.system_settings set value=to_jsonb('gen4.5'::text),updated_at=now() where key='runway_model';
insert into public.system_settings(key,value) select 'runway_image_model',to_jsonb('gen4_image_turbo'::text) where not exists(select 1 from public.system_settings where key='runway_image_model');
insert into public.system_settings(key,value) select 'runway_audio_model',to_jsonb('eleven_text_to_sound_v2'::text) where not exists(select 1 from public.system_settings where key='runway_audio_model');

do $$ declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname='visionweaver-studio-tick';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
end $$;
select cron.schedule('visionweaver-studio-tick','* * * * *',$cron$
select net.http_post(
  url:='https://yqealeekngxooyoemfba.supabase.co/functions/v1/visionweaver-studio',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='VISIONWEAVER_CRON_SECRET')),
  body:='{"action":"tick","source":"pg_cron"}'::jsonb,
  timeout_milliseconds:=110000
);
$cron$);


-- Cover existing and new foreign-key joins used by the studio.
create index if not exists vw_projects_template_idx on public.vw_projects(template_id);
create index if not exists vw_assets_project_idx on public.vw_assets(project_id);
create index if not exists vw_assets_generation_idx on public.vw_assets(generation_id);
