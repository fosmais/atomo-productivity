-- Disposable PostgreSQL only. Minimal fixtures mirror columns required by
-- the PROD FK/CHECK constraints; this is not the full production schema.
create schema auth;
create table auth.users(id uuid primary key);
create table public.plans(id uuid primary key,user_id uuid not null,title text not null);
create table public.tasks(
 id uuid primary key,user_id uuid not null,plan_id uuid,title text not null,
 category text,status text,duration_minutes integer
);
create table public.events(
 id uuid primary key,user_id uuid not null,title text not null,category text,
 starts_at timestamptz not null,ends_at timestamptz not null
);
create table public.favorites(
 id uuid primary key,user_id uuid not null,task_id uuid,event_id uuid,
 created_at timestamptz default now()
);
create table public.google_calendar_connections(user_id uuid primary key);
create table public.myka_conversations(
 id uuid primary key,user_id uuid not null,title text not null
);
create table public.myka_messages(
 id uuid primary key,conversation_id uuid not null,user_id uuid not null,
 content text,role text,event_status text,task_status text
);
\i docs/sql/myryra-core-constraints-candidate.sql

insert into auth.users values ('11111111-1111-4111-8111-111111111111');
insert into public.plans values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Plano');
insert into public.tasks values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Tarefa','work','todo',30);
insert into public.events values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','Evento','work','2026-12-01 09:00+00','2026-12-01 10:00+00');
insert into public.favorites(user_id,task_id) values ('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.myka_conversations values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','Italiano');
insert into public.myka_messages values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','Ciao','user','legacy','legacy');

do $test$
begin
 begin
  insert into public.favorites(user_id,task_id,event_id) values
  ('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  raise exception 'Favorite accepted two targets';
 exception when check_violation then null; end;
 begin
  insert into public.tasks(id,user_id,title,category,status,duration_minutes) values
  (gen_random_uuid(),'11111111-1111-4111-8111-111111111111','Bad','invalid','todo',30);
  raise exception 'Invalid task category accepted';
 exception when check_violation then null; end;
 begin
  insert into public.myka_messages(id,conversation_id,user_id,content,role)
  values(gen_random_uuid(),'dddddddd-dddd-4ddd-8ddd-dddddddddddd','99999999-9999-4999-8999-999999999999','forged','user');
  raise exception 'Cross-owner message accepted';
 exception when foreign_key_violation then null; end;
end $test$;

-- Auth-user deletion must cascade through dependent core rows.
delete from auth.users where id='11111111-1111-4111-8111-111111111111';
do $test$
declare n int;
begin
 select (select count(*) from public.plans)+(select count(*) from public.tasks)+
        (select count(*) from public.events)+(select count(*) from public.favorites)+
        (select count(*) from public.myka_conversations)+(select count(*) from public.myka_messages)
 into n;
 if n <> 0 then raise exception 'Expected auth cascade to remove dependent rows, remaining %',n; end if;
end $test$;
