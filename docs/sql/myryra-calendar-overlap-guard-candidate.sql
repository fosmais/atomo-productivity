-- Candidate only: apply after the events table exists in a fresh isolated database.
-- Reconstructed from PROD function definition inspected 2026-11-17.
-- Do not apply to existing environments without separate migration review.
begin;
do $preflight$
begin
  if to_regclass('public.events') is null then
    raise exception 'public.events must exist before installing calendar overlap guard';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='events'
      and column_name in ('id','user_id','starts_at','ends_at','blocks_time','deleted_at')
    group by table_name having count(*) <> 6
  ) then
    raise exception 'public.events is missing required overlap-guard columns';
  end if;
end $preflight$;

create or replace function public.myryra_guard_blocking_event_overlap()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if new.deleted_at is not null or not new.blocks_time then
    return new;
  end if;
  if new.starts_at is null or new.ends_at is null or new.ends_at <= new.starts_at then
    raise exception 'Invalid event interval' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' and old.deleted_at is null and old.blocks_time
    and new.user_id is not distinct from old.user_id
    and new.starts_at is not distinct from old.starts_at
    and new.ends_at is not distinct from old.ends_at then
    return new;
  end if;
  perform pg_catalog.set_config('lock_timeout', '5s', true);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text, 77429)
  );
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
$function$;

drop trigger if exists myryra_guard_blocking_event_overlap on public.events;
create trigger myryra_guard_blocking_event_overlap
before insert or update on public.events
for each row execute function public.myryra_guard_blocking_event_overlap();
commit;
