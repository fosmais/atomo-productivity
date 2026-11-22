-- Disposable PostgreSQL 16; no real Supabase credentials.
create schema auth;
create role authenticated nologin;
create role anon nologin;
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create table public.plans(id uuid primary key,user_id uuid not null);
create table public.tasks(id uuid primary key,user_id uuid not null,plan_id uuid);
create table public.events(id uuid primary key,user_id uuid not null,deleted_at timestamptz);
create table public.favorites(id uuid primary key,user_id uuid not null,task_id uuid,event_id uuid);
create table public.google_calendar_connections(user_id uuid primary key);
create table public.myka_conversations(id uuid primary key,user_id uuid not null);
create table public.myka_messages(id uuid primary key,user_id uuid not null);
grant usage on schema public,auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
grant select,insert,update,delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
\i docs/sql/myryra-core-rls-candidate.sql

do $test$
declare n integer;
begin
 select count(*) into n from pg_policies where schemaname='public' and tablename in
 ('plans','tasks','events','favorites','google_calendar_connections','myka_conversations','myka_messages');
 if n <> 24 then raise exception 'Expected 24 policies, got %',n; end if;
 select count(*) into n from pg_class c join pg_namespace s on s.oid=c.relnamespace
 where s.nspname='public' and c.relname in
 ('plans','tasks','events','favorites','google_calendar_connections','myka_conversations','myka_messages') and c.relrowsecurity;
 if n <> 7 then raise exception 'Expected RLS on 7 tables, got %',n; end if;
 select count(*) into n from pg_policies where tablename='google_calendar_connections';
 if n <> 0 then raise exception 'Calendar tokens must have no client policies'; end if;
end $test$;

insert into public.plans values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222');
insert into public.tasks values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.events values
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','11111111-1111-4111-8111-111111111111',null),
 ('ffffffff-ffff-4fff-8fff-ffffffffffff','22222222-2222-4222-8222-222222222222',null);
insert into public.google_calendar_connections values ('11111111-1111-4111-8111-111111111111');

set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $test$
declare n integer;
begin
 select count(*) into n from public.plans;
 if n <> 1 then raise exception 'Owner A sees % plans',n; end if;
 select count(*) into n from public.tasks;
 if n <> 1 then raise exception 'Owner A sees % tasks',n; end if;
 select count(*) into n from public.events;
 if n <> 1 then raise exception 'Owner A sees % events',n; end if;
 select count(*) into n from public.google_calendar_connections;
 if n <> 0 then raise exception 'Calendar tokens exposed to client'; end if;
end $test$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $test$
declare n integer;
begin
 select count(*) into n from public.tasks;
 if n <> 1 then raise exception 'Owner B sees % tasks',n; end if;
end $test$;
reset role;
