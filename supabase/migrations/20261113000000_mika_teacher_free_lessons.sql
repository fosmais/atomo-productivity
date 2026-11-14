-- Prepare free MIKA lessons without changing production automatically.
-- Apply only to the confirmed homologation Supabase project after review.
begin;

alter table public.mika_teacher_sessions
  alter column journey_id drop not null;

alter table public.mika_teacher_sessions
  add column if not exists duration_minutes integer not null default 30;

alter table public.mika_teacher_sessions
  drop constraint if exists mika_teacher_sessions_duration_minutes_check;

alter table public.mika_teacher_sessions
  add constraint mika_teacher_sessions_duration_minutes_check
  check (duration_minutes in (15, 20, 30, 45, 60));

drop policy if exists "teacher sessions insert own journey" on public.mika_teacher_sessions;

create policy "teacher sessions insert own journey"
on public.mika_teacher_sessions for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and (
    journey_id is null
    or exists (
      select 1 from public.myryra_journeys j
      where j.id = journey_id
        and j.owner_id = (select auth.uid())
        and j.status = 'active'
    )
  )
);

commit;
