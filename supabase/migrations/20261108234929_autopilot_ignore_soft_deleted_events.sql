-- Mirrors Supabase migration 20261108234929 (already applied to the active project).
-- Keep this migration in version control for reproducible environments.
CREATE OR REPLACE FUNCTION public.reserve_autopilot_task(p_task_id uuid, p_start timestamp with time zone, p_end timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_user uuid := (select auth.uid());
  v_title text;
  v_event_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_start is null or p_end is null or p_start <= now()
     or p_end <= p_start or p_end > p_start + interval '24 hours'
     or p_start > now() + interval '8 days'
  then raise exception 'Invalid reservation interval'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 94723));

  select title into v_title from public.tasks
  where id = p_task_id and user_id = v_user and completed = false
    and duration_minutes = extract(epoch from (p_end - p_start)) / 60
  for update;
  if v_title is null then raise exception 'Task unavailable or duration changed'; end if;

  if exists (
    select 1 from public.events
    where user_id = v_user
      and deleted_at is null
      and ((blocks_time = true and starts_at < p_end and ends_at > p_start)
           or notes = 'Tarefa MYRYRA: ' || p_task_id::text)
  ) then raise exception 'Calendar conflict or duplicate reservation'; end if;

  insert into public.events
    (user_id, title, starts_at, ends_at, notes, event_type, blocks_time)
  values
    (v_user, left('AutoPilot · ' || v_title, 200), p_start, p_end,
     'Tarefa MYRYRA: ' || p_task_id::text, 'appointment', true)
  returning id into v_event_id;
  return v_event_id;
end;
$function$
;
