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


-- Authorization negatives: unauthenticated and cross-tenant proposal must not execute.
insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');
insert into public.mika_action_proposals(id,user_id,action_type,payload,status,approved_at)
values (
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '11111111-1111-4111-8111-111111111111',
 'create_task',
 '{"type":"create_task","title":"Valid test task","reason":"Smoke test","due_at":null,"plan_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}'::jsonb,
 'approved',now()
);
insert into public.mika_action_audit(proposal_id,user_id,event_type)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','approved');
grant usage on schema public,auth to authenticated;
grant execute on function auth.uid() to authenticated;
set role authenticated;
do $test$
begin
 perform set_config('request.jwt.claim.sub','',false);
 begin
  perform public.mika_execute_approved_task('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  raise exception 'Unauthenticated execution unexpectedly succeeded';
 exception when sqlstate '28000' then null; end;
 perform set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
 begin
  perform public.mika_execute_approved_task('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  raise exception 'Cross-tenant execution unexpectedly succeeded';
 exception when sqlstate 'P0002' then null; end;
end $test$;
reset role;
do $test$
declare n int;
begin
 select count(*) into n from public.tasks;
 if n<>0 then raise exception 'Unauthorized execution created tasks'; end if;
 select count(*) into n from public.mika_action_proposals where status='approved';
 if n<>1 then raise exception 'Unauthorized execution changed proposal status'; end if;
end $test$;
