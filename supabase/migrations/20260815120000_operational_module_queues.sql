-- Section 9: make every Master Dashboard module an operational queue.
begin;
create table if not exists public.ceo_module_activity(
 id bigint generated always as identity primary key,
 organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
 module_record_id uuid not null references public.ceo_module_records(id) on delete cascade,
 module_key text not null,
 event_type text not null check(event_type in('created','state_changed','updated','note_added')),
 from_state text,
 to_state text,
 note text,
 actor_id uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists ceo_module_activity_record_idx on public.ceo_module_activity(organization_id,module_record_id,created_at desc);
create index if not exists ceo_module_activity_module_idx on public.ceo_module_activity(organization_id,module_key,created_at desc);
alter table public.ceo_module_activity enable row level security;
create policy "members read module activity" on public.ceo_module_activity for select to authenticated
 using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=ceo_module_activity.organization_id and m.user_id=(select auth.uid()) and m.status='active'));
create policy "operators append module activity" on public.ceo_module_activity for insert to authenticated
 with check(actor_id=(select auth.uid()) and exists(select 1 from public.ceo_organization_memberships m where m.organization_id=ceo_module_activity.organization_id and m.user_id=(select auth.uid()) and m.status='active' and m.role in('architect','ceo','operator','auditor')));
grant select,insert,update on public.ceo_module_records to authenticated;
grant select,insert on public.ceo_module_activity to authenticated;
grant usage,select on sequence public.ceo_module_activity_id_seq to authenticated;
commit;
