-- Atomic Journey lesson booking. Apply before enabling the RPC in the UI.
create or replace function public.myryra_book_journey_lesson(
  p_journey_id uuid, p_mission_id uuid, p_starts_at timestamptz
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_title text;
  v_end timestamptz := p_starts_at + interval '20 minutes';
  v_id uuid;
  v_marker text := 'missão ' || p_mission_id::text || '.';
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_starts_at is null or p_starts_at < now() + interval '1 minute'
    or p_starts_at > now() + interval '2 years' then
    raise exception 'Invalid lesson time' using errcode = '22023';
  end if;
  -- Bound wait time so a busy Agenda cannot leave a lesson request hanging indefinitely.
  perform pg_catalog.set_config('lock_timeout', '5s', true);
  -- Serialize all Journey bookings for this user; two concurrent RPCs cannot pass the checks together.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 77429));
  -- Serialize Journey lesson bookings for this user only. A table-wide lock here
  -- would block unrelated users' Agenda writes and degrade under normal traffic.
  -- Direct Agenda writers do not share this advisory lock, so concurrent writes
  -- outside this RPC still require a separate calendar-level conflict strategy.
  select m.title into v_title
  from public.myryra_journey_missions m
  join public.myryra_journeys j on j.id = m.journey_id
  where m.id = p_mission_id and m.journey_id = p_journey_id
    and j.owner_id = v_user and j.status = 'active' and m.status = 'pending';
  if not found then
    raise exception 'Active mission not found' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.events e
    where e.user_id = v_user and e.deleted_at is null
      and e.notes like ('Jornada ' || p_journey_id::text || ' · missão ' || p_mission_id::text || '.%')
  ) then
    raise exception 'Mission already scheduled' using errcode = '23505';
  end if;
  if exists (
    select 1 from public.events e
    where e.user_id = v_user and e.deleted_at is null and e.blocks_time
      and e.starts_at < v_end and e.ends_at > p_starts_at
  ) then
    raise exception 'Calendar time conflict' using errcode = '23P01';
  end if;
  insert into public.events
    (user_id, title, starts_at, ends_at, notes, event_type, blocks_time, category)
  values
    (v_user, left('Journey · ' || v_title, 200), p_starts_at, v_end,
     'Jornada ' || p_journey_id::text || ' · ' || v_marker ||
     ' Abra a Journey e selecione Iniciar com a MIKA.',
     'appointment', true, 'personal')
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.myryra_book_journey_lesson(uuid, uuid, timestamptz) from public, anon;
grant execute on function public.myryra_book_journey_lesson(uuid, uuid, timestamptz) to authenticated;

-- Serialize ALL blocking Agenda writes with Journey bookings for the same user.
-- A BEFORE trigger shares the same per-user advisory transaction lock as the RPC.
-- This closes the race between direct Agenda inserts and Journey lesson bookings,
-- without locking events belonging to unrelated users.
create or replace function public.myryra_guard_blocking_event_overlap()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.deleted_at is not null or not new.blocks_time then
    return new;
  end if;
  if new.starts_at is null or new.ends_at is null or new.ends_at <= new.starts_at then
    raise exception 'Invalid event interval' using errcode = '22023';
  end if;
  -- Preserve legacy overlapping events when an update does not change their
  -- blocking interval or owner. Newly blocking/moved events are still checked.
  if tg_op = 'UPDATE' and old.deleted_at is null and old.blocks_time
    and new.user_id is not distinct from old.user_id
    and new.starts_at is not distinct from old.starts_at
    and new.ends_at is not distinct from old.ends_at then
    return new;
  end if;
  perform pg_catalog.set_config('lock_timeout', '5s', true);
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 77429));
  if exists (
    select 1 from public.events e
    where e.user_id = new.user_id
      and e.id is distinct from new.id
      and e.deleted_at is null and e.blocks_time
      and e.starts_at < new.ends_at and e.ends_at > new.starts_at
  ) then
    raise exception 'Calendar time conflict' using errcode = '23P01';
  end if;
  return new;
end;
$$;
revoke all on function public.myryra_guard_blocking_event_overlap() from public, anon, authenticated;
drop trigger if exists myryra_guard_blocking_event_overlap on public.events;
create trigger myryra_guard_blocking_event_overlap
before insert or update of user_id, starts_at, ends_at, blocks_time, deleted_at
on public.events
for each row execute function public.myryra_guard_blocking_event_overlap();
