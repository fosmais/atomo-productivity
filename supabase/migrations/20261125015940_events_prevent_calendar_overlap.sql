create or replace function public.prevent_mika_calendar_overlap()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.blocks_time and new.deleted_at is null then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text,0));
  if exists(select 1 from public.events e where e.user_id=new.user_id and e.id is distinct from new.id and e.deleted_at is null and e.blocks_time=true and e.starts_at<new.ends_at and e.ends_at>new.starts_at) then
   raise exception using errcode='23P01',message='Este horário já está ocupado por outro compromisso.';
  end if;
 end if;
 return new;
end;
$$;
revoke all on function public.prevent_mika_calendar_overlap() from public,anon,authenticated;
drop trigger if exists events_prevent_mika_calendar_overlap on public.events;
create trigger events_prevent_mika_calendar_overlap before insert or update of user_id,starts_at,ends_at,blocks_time,deleted_at on public.events for each row execute function public.prevent_mika_calendar_overlap();
