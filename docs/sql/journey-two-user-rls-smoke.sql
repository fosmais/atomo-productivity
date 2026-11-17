-- Disposable PostgreSQL only: exercise RLS using two simulated authenticated users.
-- This is not a Supabase Auth end-to-end test.
begin;
create or replace function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated;
insert into auth.users(id) values
('11111111-1111-4111-8111-111111111111'),
('22222222-2222-4222-8222-222222222222');
commit;

set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
insert into public.myryra_journeys(id,owner_id,title) values
('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Journey user A');
do $test$
declare n int;
begin
  select count(*) into n from public.myryra_journeys;
  if n <> 1 then raise exception 'User A cannot read own Journey'; end if;
end $test$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $test$
declare n int;
begin
  select count(*) into n from public.myryra_journeys;
  if n <> 0 then raise exception 'User B can read User A Journey'; end if;
  update public.myryra_journeys set title='tampered';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'User B updated User A Journey'; end if;
  delete from public.myryra_journeys;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'User B deleted User A Journey'; end if;
end $test$;
do $test$
begin
  begin
    insert into public.myryra_journeys(owner_id,title) values
      ('11111111-1111-4111-8111-111111111111','forged owner');
    raise exception 'Cross-owner insert was allowed';
  exception when insufficient_privilege then null;
  end;
end $test$;
reset role;
do $test$
declare n int;
begin
  select count(*) into n from public.myryra_journeys where title='Journey user A';
  if n <> 1 then raise exception 'Original Journey modified'; end if;
end $test$;
