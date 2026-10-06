-- VisionWeaver Book Pipeline (Book Director)
-- Four layers: idea intake -> research -> multi-agent generation -> output assembly.
-- State lives in these tables (the directive's Airtable role). The Book Director
-- edge function (visionweaver-book-director) is the only writer; signed-in
-- organization members get read access through RLS.
-- Additive only: no existing table, policy or function is changed.

-- ---------------------------------------------------------------- books
create table if not exists public.vw_books (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.ceo_organizations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled book',
  status text not null default 'intake' check (status in (
    'intake','research','awaiting_research_approval','outline','awaiting_outline_approval',
    'chapters','design','cover','critic','awaiting_chapters_approval','revision',
    'awaiting_assembly_approval','assembly','complete','paused','rejected','cancelled')),
  paused_stage text,
  source_type text not null default 'manual' check (source_type in
    ('manual','google_books','rss','thelma_queue','trend_radar')),
  source jsonb not null default '{}'::jsonb,
  idea text not null default '',
  brief jsonb,
  options jsonb not null default '{}'::jsonb,
  research_brief jsonb,
  outline jsonb,
  design jsonb,
  cover jsonb,
  critic jsonb,
  director_notes jsonb not null default '[]'::jsonb,
  outputs jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  usage jsonb not null default '{}'::jsonb,
  error text,
  step_attempts integer not null default 0,
  revision_round integer not null default 0,
  locked_at timestamptz,
  locked_by text,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists vw_books_org_idx on public.vw_books (organization_id, created_at desc);
create index if not exists vw_books_owner_idx on public.vw_books (owner_id);
create index if not exists vw_books_runnable_idx on public.vw_books (status, updated_at);

create table if not exists public.vw_book_chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.vw_books(id) on delete cascade,
  chapter_number integer not null,
  title text not null,
  description text not null default '',
  target_words integer not null default 2000,
  research jsonb,
  content_md text not null default '',
  parts_total integer not null default 1,
  parts_done integer not null default 0,
  word_count integer not null default 0,
  status text not null default 'pending' check (status in
    ('pending','researched','drafting','drafted','needs_revision','revised','failed')),
  revision_notes jsonb not null default '[]'::jsonb,
  step_attempts integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book_id, chapter_number)
);

create table if not exists public.vw_book_approvals (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.vw_books(id) on delete cascade,
  gate text not null check (gate in ('research','outline','chapters','assembly')),
  decision text not null check (decision in ('approved','changes_requested','rejected','auto_approved')),
  notes text not null default '',
  decided_by uuid references auth.users(id),
  decided_at timestamptz not null default now(),
  snapshot jsonb not null default '{}'::jsonb
);
create index if not exists vw_book_approvals_book_idx on public.vw_book_approvals (book_id, decided_at desc);
create index if not exists vw_book_approvals_decided_by_idx on public.vw_book_approvals (decided_by);

create table if not exists public.vw_book_events (
  id bigint generated always as identity primary key,
  book_id uuid references public.vw_books(id) on delete cascade,
  scan_id uuid,
  at timestamptz not null default now(),
  stage text not null default '',
  level text not null default 'info' check (level in ('info','warn','error')),
  message text not null,
  detail jsonb not null default '{}'::jsonb
);
create index if not exists vw_book_events_book_idx on public.vw_book_events (book_id, at desc);
create index if not exists vw_book_events_scan_idx on public.vw_book_events (scan_id, at desc);
create index if not exists vw_book_events_usage_idx on public.vw_book_events (at) where stage = 'usage';

-- ------------------------------------------------- idea intake (layer 1)
create table if not exists public.vw_book_idea_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.ceo_organizations(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  submitted_by text not null default 'THELMA',
  idea text not null,
  source_url text,
  options jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','converted','dismissed')),
  book_id uuid references public.vw_books(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists vw_book_idea_queue_org_idx on public.vw_book_idea_queue (organization_id, status, created_at desc);
create index if not exists vw_book_idea_queue_owner_idx on public.vw_book_idea_queue (owner_id);
create index if not exists vw_book_idea_queue_book_idx on public.vw_book_idea_queue (book_id);

create table if not exists public.vw_book_sources (
  slug text primary key,
  name text not null,
  method text not null check (method in ('apple_books','open_library','google_books','rss','web_search')),
  config jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.vw_book_trend_scans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.ceo_organizations(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  scan_type text not null default 'radar' check (scan_type in ('radar','google_books','rss')),
  params jsonb not null default '{}'::jsonb,
  requested_by text not null default 'user',
  status text not null default 'scanning' check (status in ('scanning','ranking','complete','failed')),
  summary jsonb not null default '{}'::jsonb,
  error text,
  step_attempts integer not null default 0,
  locked_at timestamptz,
  locked_by text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists vw_book_trend_scans_org_idx on public.vw_book_trend_scans (organization_id, started_at desc);
create index if not exists vw_book_trend_scans_owner_idx on public.vw_book_trend_scans (owner_id);

create table if not exists public.vw_book_trend_scan_sources (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.vw_book_trend_scans(id) on delete cascade,
  source_slug text not null,
  source_name text not null,
  method text not null,
  config jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','running','ok','no_data','failed')),
  item_count integer not null default 0,
  grounded boolean not null default false,
  citations jsonb not null default '[]'::jsonb,
  error text,
  step_attempts integer not null default 0,
  locked_at timestamptz,
  finished_at timestamptz
);
create index if not exists vw_book_trend_scan_sources_scan_idx on public.vw_book_trend_scan_sources (scan_id, status);

create table if not exists public.vw_book_trend_items (
  id bigint generated always as identity primary key,
  scan_id uuid not null references public.vw_book_trend_scans(id) on delete cascade,
  source_slug text not null,
  list_name text not null default '',
  rank integer,
  title text not null,
  author text not null default '',
  genre text not null default '',
  url text not null default ''
);
create index if not exists vw_book_trend_items_scan_idx on public.vw_book_trend_items (scan_id, source_slug);

create table if not exists public.vw_book_opportunities (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.vw_book_trend_scans(id) on delete cascade,
  organization_id uuid references public.ceo_organizations(id) on delete cascade,
  rank integer not null,
  score numeric not null default 0,
  theme text not null default '',
  genre text not null default '',
  idea jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new','picked','dismissed')),
  book_id uuid references public.vw_books(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists vw_book_opportunities_scan_idx on public.vw_book_opportunities (scan_id, rank);
create index if not exists vw_book_opportunities_org_idx on public.vw_book_opportunities (organization_id, status, created_at desc);
create index if not exists vw_book_opportunities_book_idx on public.vw_book_opportunities (book_id);

-- ------------------------------------------------------------ triggers
create trigger vw_books_touch before update on public.vw_books
  for each row execute function public.vw_touch_updated_at();
create trigger vw_book_chapters_touch before update on public.vw_book_chapters
  for each row execute function public.vw_touch_updated_at();

-- ----------------------------------------------------------------- RLS
-- Read-only for active members of the owning organization. All writes go
-- through the Book Director function with the service role.
alter table public.vw_books enable row level security;
alter table public.vw_book_chapters enable row level security;
alter table public.vw_book_approvals enable row level security;
alter table public.vw_book_events enable row level security;
alter table public.vw_book_idea_queue enable row level security;
alter table public.vw_book_sources enable row level security;
alter table public.vw_book_trend_scans enable row level security;
alter table public.vw_book_trend_scan_sources enable row level security;
alter table public.vw_book_trend_items enable row level security;
alter table public.vw_book_opportunities enable row level security;

create policy "book pipeline members read books" on public.vw_books
  for select to authenticated using ((select public.is_active_org_member(organization_id)));
create policy "book pipeline members read chapters" on public.vw_book_chapters
  for select to authenticated using (exists (select 1 from public.vw_books b
    where b.id = vw_book_chapters.book_id and (select public.is_active_org_member(b.organization_id))));
create policy "book pipeline members read approvals" on public.vw_book_approvals
  for select to authenticated using (exists (select 1 from public.vw_books b
    where b.id = vw_book_approvals.book_id and (select public.is_active_org_member(b.organization_id))));
create policy "book pipeline members read events" on public.vw_book_events
  for select to authenticated using (exists (select 1 from public.vw_books b
    where b.id = vw_book_events.book_id and (select public.is_active_org_member(b.organization_id))));
create policy "book pipeline members read idea queue" on public.vw_book_idea_queue
  for select to authenticated using ((select public.is_active_org_member(organization_id)));
create policy "book pipeline signed-in read sources" on public.vw_book_sources
  for select to authenticated using (true);
create policy "book pipeline members read scans" on public.vw_book_trend_scans
  for select to authenticated using ((select public.is_active_org_member(organization_id)));
create policy "book pipeline members read scan sources" on public.vw_book_trend_scan_sources
  for select to authenticated using (exists (select 1 from public.vw_book_trend_scans s
    where s.id = vw_book_trend_scan_sources.scan_id and (select public.is_active_org_member(s.organization_id))));
create policy "book pipeline members read trend items" on public.vw_book_trend_items
  for select to authenticated using (exists (select 1 from public.vw_book_trend_scans s
    where s.id = vw_book_trend_items.scan_id and (select public.is_active_org_member(s.organization_id))));
create policy "book pipeline members read opportunities" on public.vw_book_opportunities
  for select to authenticated using ((select public.is_active_org_member(organization_id)));

-- -------------------------------------------------------- work claiming
-- One unit of work per call, safe for several workers at once.
create or replace function public.vw_book_claim_work(p_worker text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_stale constant interval := interval '4 minutes';
  v_limit numeric;
  v_since timestamptz;
  v_spent numeric;
begin
  -- 0. spending limit. The Book Director writes the cost of every model call to
  --    vw_book_events (stage 'usage'). When the total since the start mark reaches
  --    the limit in system_settings, all work is paused and nothing more is claimed.
  select nullif(value #>> '{}', '')::numeric into v_limit from public.system_settings where key = 'book_pipeline_budget_usd';
  if v_limit is not null then
    select nullif(value #>> '{}', '')::timestamptz into v_since from public.system_settings where key = 'book_pipeline_budget_since';
    select coalesce(sum((detail ->> 'cost_usd')::numeric), 0) into v_spent
      from public.vw_book_events where stage = 'usage' and at >= coalesce(v_since, '-infinity'::timestamptz);
    if v_spent >= v_limit then
      update public.vw_books
         set paused_stage = status, status = 'paused', locked_at = null, step_attempts = 0,
             error = format('Spending limit of $%s reached (about $%s used). Raise the limit to continue.', v_limit, round(v_spent, 2))
       where status in ('intake','research','outline','chapters','design','cover','critic','revision','assembly');
      update public.vw_book_trend_scans
         set status = 'failed', completed_at = now(), locked_at = null,
             error = 'Spending limit reached before this scan finished.'
       where status in ('scanning','ranking');
      return null;
    end if;
  end if;

  -- 1. a book in a runnable stage
  select id into v_id from public.vw_books
   where status in ('intake','research','outline','chapters','design','cover','critic','revision','assembly')
     and (locked_at is null or locked_at < now() - v_stale)
   order by updated_at asc
   limit 1 for update skip locked;
  if v_id is not null then
    update public.vw_books set locked_at = now(), locked_by = p_worker where id = v_id;
    return jsonb_build_object('kind','book','id',v_id);
  end if;

  -- 2. one queued trend source
  select ss.id into v_id from public.vw_book_trend_scan_sources ss
    join public.vw_book_trend_scans s on s.id = ss.scan_id and s.status = 'scanning'
   where (ss.status = 'queued' or (ss.status = 'running' and ss.locked_at < now() - v_stale))
   order by ss.locked_at nulls first, ss.source_slug
   limit 1 for update of ss skip locked;
  if v_id is not null then
    update public.vw_book_trend_scan_sources
       set status = 'running', locked_at = now() where id = v_id;
    return jsonb_build_object('kind','scan_source','id',v_id);
  end if;

  -- 3. a scan whose sources are all finished and that still needs ranking
  select s.id into v_id from public.vw_book_trend_scans s
   where s.status in ('scanning','ranking')
     and (s.locked_at is null or s.locked_at < now() - v_stale)
     and not exists (select 1 from public.vw_book_trend_scan_sources ss
                      where ss.scan_id = s.id and ss.status in ('queued','running'))
   order by s.started_at asc
   limit 1 for update skip locked;
  if v_id is not null then
    update public.vw_book_trend_scans
       set status = 'ranking', locked_at = now(), locked_by = p_worker where id = v_id;
    return jsonb_build_object('kind','scan_rank','id',v_id);
  end if;

  return null;
end;
$$;
revoke all on function public.vw_book_claim_work(text) from public, anon, authenticated;
grant execute on function public.vw_book_claim_work(text) to service_role;

-- --------------------------------------------------------- seed sources
-- 22 book selling / searching sites. Three have official open feeds; the
-- rest are read through live web search limited to that site, because
-- they do not allow direct automated reading of their pages.
insert into public.vw_book_sources (slug, name, method, config, notes) values
  ('apple-books-paid','Apple Books: Top Paid','apple_books','{"feed":"top-paid","country":"us","limit":50}','Official Apple RSS feed'),
  ('apple-books-free','Apple Books: Top Free','apple_books','{"feed":"top-free","country":"us","limit":50}','Official Apple RSS feed'),
  ('open-library-trending','Open Library: Trending','open_library','{"window":"daily","limit":50}','Official Open Library API'),
  ('google-books-new','Google Books: New by category','google_books','{"categories":["fiction","self-help","business","juvenile nonfiction","young adult fiction","health","history","religion"],"per_category":10}','Official Google Books API; newest titles, not a sales rank'),
  ('amazon','Amazon Books','web_search','{"domain":"amazon.com","lists":"Best Sellers in Books, Movers & Shakers in Books, Hot New Releases in Books"}',''),
  ('barnes-noble','Barnes & Noble','web_search','{"domain":"barnesandnoble.com","lists":"B&N Top 100 bestsellers and new releases"}',''),
  ('goodreads','Goodreads','web_search','{"domain":"goodreads.com","lists":"most read this week, popular new releases, Goodreads Choice"}',''),
  ('bookshop','Bookshop.org','web_search','{"domain":"bookshop.org","lists":"bestsellers and trending lists"}',''),
  ('kobo','Rakuten Kobo','web_search','{"domain":"kobo.com","lists":"top 50 ebooks and trending now"}',''),
  ('audible','Audible','web_search','{"domain":"audible.com","lists":"best sellers and trending audiobooks"}',''),
  ('nyt','New York Times Best Sellers','web_search','{"domain":"nytimes.com","lists":"The New York Times Best Sellers, current week, fiction and nonfiction"}',''),
  ('usa-today','USA TODAY Best-Selling Booklist','web_search','{"domain":"usatoday.com","lists":"best-selling booklist, current week"}',''),
  ('publishers-weekly','Publishers Weekly','web_search','{"domain":"publishersweekly.com","lists":"bestseller lists, current week"}',''),
  ('books-a-million','Books-A-Million','web_search','{"domain":"booksamillion.com","lists":"bestsellers and new releases"}',''),
  ('thriftbooks','ThriftBooks','web_search','{"domain":"thriftbooks.com","lists":"trending and most popular books"}',''),
  ('waterstones','Waterstones','web_search','{"domain":"waterstones.com","lists":"bestsellers and books of the month"}',''),
  ('indigo','Indigo','web_search','{"domain":"indigo.ca","lists":"bestsellers and trending books"}',''),
  ('target','Target Books','web_search','{"domain":"target.com","lists":"best selling books"}',''),
  ('walmart','Walmart Books','web_search','{"domain":"walmart.com","lists":"best selling books"}',''),
  ('bookbub','BookBub','web_search','{"domain":"bookbub.com","lists":"most anticipated and trending books"}',''),
  ('storygraph','The StoryGraph','web_search','{"domain":"thestorygraph.com","lists":"popular and trending books this week"}',''),
  ('powells','Powell''s Books','web_search','{"domain":"powells.com","lists":"bestsellers and staff picks"}','')
on conflict (slug) do nothing;

-- ------------------------------------------------------------- storage
-- Private bucket for book files (PDF, EPUB, Markdown, metadata, cover, fonts).
-- Files are only handed out as short-lived signed links by the Book Director.
insert into storage.buckets (id, name, public, file_size_limit)
values ('visionweaver-books', 'visionweaver-books', false, 104857600)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- cron
-- Three workers a minute. An idle tick is one cheap database call.
select cron.schedule('visionweaver-book-director-tick', '* * * * *', $cron$
  select net.http_post(
    url := 'https://yqealeekngxooyoemfba.supabase.co/functions/v1/visionweaver-book-director',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='VISIONWEAVER_CRON_SECRET')),
    body := jsonb_build_object('action','tick','source','pg_cron','worker',w),
    timeout_milliseconds := 15000)
  from generate_series(1,3) as w;
$cron$);
-- T.H.E.L.M.A. trend radar: Mondays 13:05 UTC.
select cron.schedule('visionweaver-book-radar-weekly', '5 13 * * 1', $cron$
  select net.http_post(
    url := 'https://yqealeekngxooyoemfba.supabase.co/functions/v1/visionweaver-book-director',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='VISIONWEAVER_CRON_SECRET')),
    body := '{"action":"scheduled_scan","source":"pg_cron"}'::jsonb,
    timeout_milliseconds := 15000);
$cron$);
