-- Disposable PG16 only. Replays MIKA Agent function after preview-derived foundation.
create schema auth;
create table auth.users(id uuid primary key);
create role authenticated nologin;
create role anon nologin;
create role service_role nologin;
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
\i docs/sql/myryra-core-foundation-candidate.sql
\i docs/sql/myryra-core-constraints-candidate.sql
\i docs/sql/myryra-mika-agent-preview-foundation-candidate.sql
\i supabase/migrations/20261109120000_mika_execution_approved_plan_compat.sql
do $test$
declare n int;
begin
 if to_regprocedure('public.mika_execute_approved_task(uuid,uuid)') is null then
  raise exception 'MIKA Agent execution function missing';
 end if;
 select count(*) into n from pg_policies
 where schemaname='public' and tablename in ('mika_action_proposals','mika_action_audit');
 if n<>2 then raise exception 'Expected two owner-read policies, found %',n; end if;
 select count(*) into n from pg_indexes
 where schemaname='public' and tablename in ('mika_action_proposals','mika_action_audit');
 if n<>8 then raise exception 'Expected eight MIKA Agent indexes, found %',n; end if;
end $test$;
