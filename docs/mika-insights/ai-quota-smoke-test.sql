-- Execute ONLY on Supabase MVP2 preview with at least two test users.
-- All simulated usage is rolled back. Do not run on production.
begin;
do $$
declare u1 uuid; u2 uuid; ok boolean; i integer;
begin
 select id into u1 from auth.users order by id limit 1;
 select id into u2 from auth.users where id <> u1 order by id limit 1;
 if u1 is null or u2 is null then raise exception 'Two test users required'; end if;
 perform set_config('request.jwt.claim.sub', u1::text, true);
 execute 'set local role authenticated';
 for i in 1..12 loop
   select public.mika_consume_ai_quota('suggest') into ok;
   if ok is distinct from true then raise exception 'Suggestion denied at %', i; end if;
 end loop;
 select public.mika_consume_ai_quota('suggest') into ok;
 if ok is distinct from false then raise exception 'Suggestion 13 should be blocked'; end if;
 for i in 1..20 loop
   select public.mika_consume_ai_quota('transcribe') into ok;
   if ok is distinct from true then raise exception 'Transcription denied at %', i; end if;
 end loop;
 select public.mika_consume_ai_quota('transcribe') into ok;
 if ok is distinct from false then raise exception 'Transcription 21 should be blocked'; end if;
 select public.mika_consume_ai_quota('invalid') into ok;
 if ok is distinct from false then raise exception 'Invalid action should be blocked'; end if;
 perform set_config('request.jwt.claim.sub', u2::text, true);
 select public.mika_consume_ai_quota('suggest') into ok;
 if ok is distinct from true then raise exception 'Second user not isolated'; end if;
end $$;
rollback;
