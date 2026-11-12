-- LOCAL DISPOSABLE SUPABASE ONLY. This script writes synthetic users/events
-- inside a transaction and always rolls back. NEVER run in production.
-- Prerequisites: tests/fixtures/journey-agenda-local-bootstrap.sql and
-- supabase/migrations/20261112000100_myryra_journey_lesson_atomic.sql.
begin;
-- Synthetic auth.users rows: use local auth schema defaults for other fields.
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
 ('00000000-0000-4000-8000-000000000101','00000000-0000-0000-0000-000000000000','authenticated','authenticated','journey-local-101@example.invalid',now(),now()),
 ('00000000-0000-4000-8000-000000000102','00000000-0000-0000-0000-000000000000','authenticated','authenticated','journey-local-102@example.invalid',now(),now());
insert into public.myryra_journeys(id,owner_id,title)
values
 ('00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000101','Aprender italiano'),
 ('00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000102','Aprender piano');
insert into public.myryra_journey_missions(id,journey_id,title)
values
 ('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000201','Praticar cumprimentos'),
 ('00000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000202','Praticar escalas');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
do $$
declare
 v_start timestamptz:=now()+interval '1 day';
 v_event uuid;
 v_count integer;
begin
 v_event:=public.myryra_book_journey_lesson(
 '00000000-0000-4000-8000-000000000201',
 '00000000-0000-4000-8000-000000000301',v_start);
 select count(*) into v_count from public.events
 where id=v_event and user_id=auth.uid() and blocks_time
 and ends_at-starts_at=interval '20 minutes';
 if v_count<>1 then raise exception 'Lesson persistence or duration incorrect'; end if;
 begin
  perform public.myryra_book_journey_lesson(
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000301',v_start+interval '1 hour');
  raise exception 'Duplicate was accepted';
 exception when unique_violation then null;
 end;
 begin
  perform public.myryra_book_journey_lesson(
  '00000000-0000-4000-8000-000000000202',
  '00000000-0000-4000-8000-000000000302',v_start+interval '1 hour');
  raise exception 'Foreign owner accepted';
 exception when no_data_found then null;
 end;
 -- Another mission owned by this user should conflict with booked time.
 insert into public.myryra_journey_missions(id,journey_id,title)
 values ('00000000-0000-4000-8000-000000000303',
 '00000000-0000-4000-8000-000000000201','Revisar vocabulário');
 begin
  perform public.myryra_book_journey_lesson(
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000303',v_start+interval '5 minutes');
  raise exception 'Overlapping blocked event accepted';
 exception when exclusion_violation then null;
 end;
 raise notice 'Local Journey booking integration smoke passed';
end $$;
reset role;
rollback;
-- Concurrency/race tests require TWO separate DB sessions and are NOT
-- covered by this single-session smoke test.
