-- MIKA Concierge preferences attached to an existing MYRYRA event.
create table if not exists public.event_concierge (
  event_id uuid primary key references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  departure_address text check (char_length(departure_address) <= 300),
  services text[] not null default '{}',
  status text not null default 'planning' check (status in ('planning', 'ready', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_concierge_services_valid check (services <@ array['transport','parking','restaurant','hotel']::text[])
);
create index if not exists event_concierge_user_id_idx on public.event_concierge(user_id);
alter table public.event_concierge enable row level security;
create policy "event_concierge_select_own" on public.event_concierge for select to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.events e where e.id = event_id and e.user_id = (select auth.uid()) and e.deleted_at is null));
create policy "event_concierge_insert_own" on public.event_concierge for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.events e where e.id = event_id and e.user_id = (select auth.uid()) and e.deleted_at is null));
create policy "event_concierge_update_own" on public.event_concierge for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "event_concierge_delete_own" on public.event_concierge for delete to authenticated
  using (user_id = (select auth.uid()));
