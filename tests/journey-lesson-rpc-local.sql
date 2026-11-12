-- Run ONLY on a disposable local Supabase database after applying the
-- Journey/Agenda fixture and atomic lesson booking RPC.
-- Read-only contract smoke test; no production data or user impersonation.
do $$
declare
 v_proc oid;
 v_security_definer boolean;
 v_search_path text;
 v_rls_count integer;
begin
 select p.oid,p.prosecdef,
   (select x from unnest(coalesce(p.proconfig,array[]::text[])) x
    where x like 'search_path=%' limit 1)
 into v_proc,v_security_definer,v_search_path
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='myryra_book_journey_lesson'
 and pg_get_function_identity_arguments(p.oid)='p_journey_id uuid, p_mission_id uuid, p_starts_at timestamp with time zone';
 if v_proc is null then raise exception 'Lesson RPC not installed'; end if;
 if v_security_definer then raise exception 'RPC must be SECURITY INVOKER'; end if;
 if v_search_path not in ('search_path=', 'search_path=""') or v_search_path is null then
   raise exception 'RPC must have empty search_path, found %',v_search_path;
 end if;
 select count(*) into v_rls_count
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname in
 ('myryra_journeys','myryra_journey_missions','events') and c.relrowsecurity;
 if v_rls_count<>3 then raise exception 'Missing RLS on fixture tables'; end if;
 if has_function_privilege('anon',v_proc,'EXECUTE') then
   raise exception 'Anonymous role can execute lesson booking RPC';
 end if;
 if not has_function_privilege('authenticated',v_proc,'EXECUTE') then
   raise exception 'Authenticated role lacks lesson booking RPC access';
 end if;
 raise notice 'Journey lesson RPC schema smoke test passed';
end $$;
-- Integration cases still required: authenticated owner success; foreign owner
-- denied; inactive Journey/mission denied; overlapping blocked event rejected;
-- duplicate booking rejected; parallel requests serialized; soft-deleted
-- events ignored; direct Agenda write race; 20-minute duration persisted.
