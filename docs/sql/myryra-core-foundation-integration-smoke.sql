-- End-to-end disposable PostgreSQL schema reconstruction.
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
grant select on all tables in schema public to anon;

do $test$
declare n int;
begin
 select count(*) into n from information_schema.columns where table_schema='public'
 and table_name in ('plans','tasks','events','favorites','myka_conversations','myka_messages','google_calendar_connections');
 if n<>57 then raise exception 'Unexpected core column count: %',n; end if;
 select count(*) into n from pg_policies where schemaname='public'
 and tablename in ('plans','tasks','events','favorites','myka_conversations','myka_messages','google_calendar_connections');
 if n<>24 then raise exception 'Expected 24 core policies, got %',n; end if;
 -- A UNIQUE constraint must own the (id,user_id) index; no independent duplicate.
 select count(*) into n from pg_constraint c
 join pg_class i on i.oid=c.conindid
 where c.conrelid='public.myka_conversations'::regclass
 and c.conname='myka_conversations_id_user_unique'
 and c.contype='u' and i.relname='myka_conversations_id_user_unique';
 if n<>1 then raise exception 'Conversation unique index is not constraint-backed'; end if;

end $test$;
insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
insert into public.plans(user_id,title) values ('11111111-1111-4111-8111-111111111111','Plano A');
insert into public.tasks(plan_id,user_id,title) select id,user_id,'Tarefa A' from public.plans;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $test$
declare n int;
begin
 select count(*) into n from public.tasks;
 if n<>0 then raise exception 'Cross-user tasks visible: %',n; end if;
 select count(*) into n from public.plans;
 if n<>0 then raise exception 'Cross-user plans visible: %',n; end if;
end $test$;
reset role;
