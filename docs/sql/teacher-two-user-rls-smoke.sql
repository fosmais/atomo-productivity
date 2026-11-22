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
-- Owner can reschedule the active session using the allowed column.
update public.mika_teacher_sessions set scheduled_at='2026-12-01 12:00:00+00';
do $test$
declare n int;
begin
  select count(*) into n from public.mika_teacher_sessions
    where scheduled_at='2026-12-01 12:00:00+00';
  if n <> 1 then raise exception 'Owner could not reschedule Teacher session'; end if;
end $test$;
-- Direct client writes to Teacher messages must fail.
do $test$
begin
  begin
    insert into public.mika_teacher_messages(session_id,owner_id,role,content)
    select id,owner_id,'user','unauthorized client write'
    from public.mika_teacher_sessions;
    raise exception 'Client inserted Teacher message';
  exception when insufficient_privilege then null;
  end;
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
  update public.mika_teacher_sessions set scheduled_at=now();
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Other user rescheduled Teacher session'; end if;
  delete from public.mika_teacher_sessions;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Other user deleted Teacher session'; end if;
end $test$;
-- A forged session must fail even when the foreign Journey ID is known.
-- Test a direct insert, rather than SELECTing an invisible row (which inserts nothing).
do $test$
begin
  begin
    insert into public.mika_teacher_sessions(owner_id,journey_id,topic)
    values ('22222222-2222-4222-8222-222222222222',
            '33333333-3333-4333-8333-333333333333','forged journey');
    raise exception 'Cross-owner session insert was allowed';
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
