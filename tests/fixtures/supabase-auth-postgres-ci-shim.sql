-- Disposable PostgreSQL CI shim for Supabase Auth ONLY.
-- NEVER run in Supabase production or on a persistent database.
create schema if not exists auth;
do $$ begin
 if not exists(select 1 from pg_roles where rolname='authenticated') then
  create role authenticated nologin;
 end if;
 if not exists(select 1 from pg_roles where rolname='anon') then
  create role anon nologin;
 end if;
end $$;
create table auth.users (
 id uuid primary key,
 instance_id uuid,
 aud text,
 role text,
 email text,
 created_at timestamptz,
 updated_at timestamptz
);
create function auth.uid() returns uuid
language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant usage on schema public,auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
-- Fixture tests seed synthetic auth.users as the postgres table owner.
