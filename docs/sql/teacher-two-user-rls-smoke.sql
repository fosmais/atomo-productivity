-- Disposable PostgreSQL only; run after journey-two-user-rls-smoke.sql.
-- Exercise Teacher session/message ownership with simulated JWT claims.
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
insert into public.mika_teacher_sessions(owner_id,journey_id,topic)
select '11111111-1111-4111-8111-111111111111',id,'Italiano'
from public.myryra_journeys where title='Journey user A';
do $test$
declare n int;
begin
  select count(*) into n from public.mika_teacher_sessions;
  if n <> 1 then raise exception 'Owner cannot read Teacher session'; end if;
end $test$;
reset role;
insert into public.mika_teacher_messages(session_id,owner_id,role,content)
select id,owner_id,'assistant','Benvenuto' from public.mika_teacher_sessions;
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $test$
declare n int;
begin
  select count(*) into n from public.mika_teacher_sessions;
  if n <> 0 then raise exception 'Other user can read Teacher session'; end if;
  select count(*) into n from public.mika_teacher_messages;
  if n <> 0 then raise exception 'Other user can read Teacher messages'; end if;
  delete from public.mika_teacher_sessions;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Other user deleted Teacher session'; end if;
end $test$;
do $test$
begin
  begin
    insert into public.mika_teacher_sessions(owner_id,journey_id,topic)
    select '22222222-2222-4222-8222-222222222222',id,'forged journey'
    from public.myryra_journeys where title='Journey user A';
    -- RLS SELECT hides the foreign Journey row; zero rows inserted.
    if found then raise exception 'Other user inserted session on owner Journey'; end if;
  exception when insufficient_privilege then null;
  end;
end $test$;
reset role;
do $test$
declare n int;
begin
  select count(*) into n from public.mika_teacher_sessions;
  if n <> 1 then raise exception 'Teacher session count changed'; end if;
  select count(*) into n from public.mika_teacher_messages;
  if n <> 1 then raise exception 'Teacher message count changed'; end if;
end $test$;
