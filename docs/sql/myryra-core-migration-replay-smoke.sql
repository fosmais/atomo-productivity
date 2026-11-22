-- Disposable PostgreSQL 16: replay selected actual checked-in migrations
-- after the reconstructed seven-table foundation.
create schema auth;
create table auth.users(id uuid primary key);
create role authenticated nologin;
create role anon nologin;
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
\i docs/sql/myryra-core-foundation-candidate.sql
\i docs/sql/myryra-core-constraints-candidate.sql
\i docs/sql/myryra-core-secondary-indexes-candidate.sql
\i docs/sql/myryra-core-rls-candidate.sql
grant usage on schema public,auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
grant select,insert,update,delete on all tables in schema public to authenticated;
\i supabase/migrations/20261101000100_myka_confirm_event.sql
\i supabase/migrations/20261104000100_event_concierge.sql
\i supabase/migrations/20261104_event_categories.sql
\i supabase/migrations/20261101000200_myka_event_invoker_security.sql
\i supabase/migrations/20261104_event_category_permissions.sql
\i supabase/migrations/20261104_event_reminders.sql
\i supabase/migrations/20261108234929_autopilot_ignore_soft_deleted_events.sql
\i supabase/migrations/20261108235224_autopilot_reject_soft_deleted_tasks.sql

do $test$
declare n integer;
begin
 if to_regprocedure('public.myka_confirm_event(uuid)') is null then raise exception 'Missing MIKA confirm function'; end if;
 if to_regclass('public.event_concierge') is null then raise exception 'Missing concierge table'; end if;
 select count(*) into n from pg_policies where schemaname='public' and tablename='event_concierge';
 if n<>4 then raise exception 'Expected four concierge policies, got %',n; end if;
 select count(*) into n from pg_constraint where conrelid='public.events'::regclass and conname='events_category_check';
 if n<>1 then raise exception 'Expected event category constraint'; end if;
 if to_regprocedure('public.reserve_autopilot_task(uuid,timestamp with time zone,timestamp with time zone)') is null then raise exception 'Missing AutoPilot reservation function'; end if;
 if to_regclass('public.event_reminders') is null then raise exception 'Missing reminders table'; end if;
 select count(*) into n from pg_policies where schemaname='public' and tablename='event_reminders';
 if n<>3 then raise exception 'Expected three reminder policies, got %',n; end if;
end $test$;
