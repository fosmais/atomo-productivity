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
 ('00000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000202','Praticar escalas'),
 ('00000000-0000-4000-8000-000000000303','00000000-0000-4000-8000-000000000201','Revisar vocabulário');
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

 begin
  perform public.myryra_book_journey_lesson(
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000303',v_start+interval '5 minutes');
  raise exception 'Overlapping blocked event accepted';
 exception when exclusion_violation then null;
 end;
 -- A past time must be rejected even if the mission is available.
 begin
  perform public.myryra_book_journey_lesson(
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000303',now()-interval '1 day');
  raise exception 'Past booking was accepted';
 exception when invalid_parameter_value then null;
 end;
 -- A paused Journey must never allow booking.
 update public.myryra_journeys set status='paused'
 where id='00000000-0000-4000-8000-000000000201';
 begin
  perform public.myryra_book_journey_lesson(
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000303',v_start+interval '2 hours');
  raise exception 'Paused Journey accepted';
 exception when no_data_found then null;
 end;
 update public.myryra_journeys set status='active'
 where id='00000000-0000-4000-8000-000000000201';
 -- Completed missions are not bookable.
 update public.myryra_journey_missions set status='completed'
 where id='00000000-0000-4000-8000-000000000303';
 begin
  perform public.myryra_book_journey_lesson(
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000303',v_start+interval '2 hours');
  raise exception 'Completed mission accepted';
 exception when no_data_found then null;
 end;
 update public.myryra_journey_missions set status='pending'
 where id='00000000-0000-4000-8000-000000000303';
 -- Soft-deleted appointments must not reserve time or block a new mission.
 update public.events set deleted_at=now() where id=v_event;
 perform public.myryra_book_journey_lesson(
 '00000000-0000-4000-8000-000000000201',
 '00000000-0000-4000-8000-000000000303',v_start);
 select count(*) into v_count from public.events
 where user_id=auth.uid() and deleted_at is null and starts_at=v_start;
 if v_count<>1 then raise exception 'Soft-deleted event still blocks slot'; end if;
 raise notice 'Local Journey booking integration smoke passed';
end $$;
reset role;
rollback;
-- Concurrency/race tests require TWO separate DB sessions and are NOT
-- covered by this single-session smoke test.
