-- MYRYRA MIKA Professora: PROPOSED schema, NOT APPLIED.
-- Apply only after review, staging validation, and a generated Supabase migration.
create table if not exists public.mika_teacher_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  journey_id uuid not null references public.myryra_journeys(id) on delete cascade,
  topic text not null check (char_length(topic) between 1 and 120),
  level text not null default 'iniciante' check (char_length(level) between 1 and 40),
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table if not exists public.mika_teacher_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default now(),
  constraint mika_teacher_messages_session_owner_fkey
    foreign key (session_id, owner_id)
    references public.mika_teacher_sessions(id, owner_id) on delete cascade
);
create index if not exists mika_teacher_sessions_owner_created_idx
  on public.mika_teacher_sessions(owner_id, created_at desc);
create index if not exists mika_teacher_messages_session_created_idx
  on public.mika_teacher_messages(session_id, created_at, id);

alter table public.mika_teacher_sessions enable row level security;
alter table public.mika_teacher_messages enable row level security;

revoke all on public.mika_teacher_sessions from anon;
revoke all on public.mika_teacher_messages from anon;
grant select, insert, delete on public.mika_teacher_sessions to authenticated;
grant select, insert on public.mika_teacher_messages to authenticated;

create policy "teacher sessions select own" on public.mika_teacher_sessions
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "teacher sessions insert own journey" on public.mika_teacher_sessions
  for insert to authenticated with check (
    (select auth.uid()) = owner_id and exists (
      select 1 from public.myryra_journeys j
      where j.id = journey_id and j.owner_id = (select auth.uid()) and j.status = 'active'
    )
  );
create policy "teacher sessions delete own" on public.mika_teacher_sessions
  for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "teacher messages select own" on public.mika_teacher_messages
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "teacher messages insert own active session" on public.mika_teacher_messages
  for insert to authenticated with check (
    (select auth.uid()) = owner_id and exists (
      select 1 from public.mika_teacher_sessions s
      where s.id = session_id and s.owner_id = (select auth.uid()) and s.status = 'active'
    )
  );
-- No UPDATE or DELETE policy on messages: preserve the original transcript.
-- Sessions are immutable after creation except full owner-controlled deletion.
-- No automatic rewards, grades, calendar writes, or background jobs.
