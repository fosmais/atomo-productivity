-- Disposable local Supabase ONLY: Journey/Agenda fixture.
-- Never apply this fixture to production. No real user records are copied.
-- Prerequisite: Supabase local stack with auth.users/auth.uid() installed.
begin;
create table if not exists public.myryra_journeys (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(btrim(title)) between 1 and 120),
 description text,
 status text not null default 'active' check (status in ('active','paused','completed','archived')),
 visibility text not null default 'private' check (visibility in ('private','shared')),
 target_date date,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 confirmation_key uuid
);
create table if not exists public.myryra_journey_missions (
 id uuid primary key default gen_random_uuid(),
 journey_id uuid not null references public.myryra_journeys(id) on delete cascade,
 title text not null check (char_length(btrim(title)) between 1 and 160),
 status text not null default 'pending' check (status in ('pending','completed')),
 due_at timestamptz,
 completed_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.events (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(title) between 1 and 200),
 starts_at timestamptz not null,
 ends_at timestamptz not null check (ends_at > starts_at),
 location text,
 notes text,
 created_at timestamptz not null default now(),
 event_type text not null default 'appointment',
 blocks_time boolean not null default false,
 deleted_at timestamptz,
 category text not null default 'personal' check (category in ('work','family','leisure','health','personal','study'))
);
create unique index if not exists myryra_journeys_owner_confirmation_key_uq
 on public.myryra_journeys(owner_id,confirmation_key) where confirmation_key is not null;
create index if not exists myryra_journeys_owner_idx on public.myryra_journeys(owner_id,created_at desc);
create index if not exists myryra_journey_missions_journey_idx on public.myryra_journey_missions(journey_id,due_at);
create index if not exists events_user_start_idx on public.events(user_id,starts_at);
alter table public.myryra_journeys enable row level security;
alter table public.myryra_journey_missions enable row level security;
alter table public.events enable row level security;
-- Owner-only access; these policies are fixture-specific, not a claim of
-- byte-for-byte equivalence with all production policies.
create policy fixture_journeys_owner on public.myryra_journeys
 for all to authenticated using (owner_id=(select auth.uid()))
 with check (owner_id=(select auth.uid()));
create policy fixture_missions_owner on public.myryra_journey_missions
 for all to authenticated using (exists (
 select 1 from public.myryra_journeys j
 where j.id=journey_id and j.owner_id=(select auth.uid())))
 with check (exists (
 select 1 from public.myryra_journeys j
 where j.id=journey_id and j.owner_id=(select auth.uid())));
create policy fixture_events_owner on public.events
 for all to authenticated using (user_id=(select auth.uid()))
 with check (user_id=(select auth.uid()));
grant select,insert,update,delete on public.myryra_journeys,public.myryra_journey_missions,public.events to authenticated;
commit;
-- Apply supabase/migrations/20261112000100_myryra_journey_lesson_atomic.sql
-- manually AFTER this fixture, then execute tests/journey-lesson-rpc-local.sql.
