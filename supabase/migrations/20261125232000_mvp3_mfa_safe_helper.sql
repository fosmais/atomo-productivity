create schema if not exists mika_internal;
create or replace function mika_internal.mfa_session_allowed()
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(auth.uid() is not null and
 (auth.jwt()->>'aal'='aal2' or (auth.jwt()->>'aal'='aal1' and not exists(
 select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified'))),false)
$$;
revoke all on function mika_internal.mfa_session_allowed() from public,anon;
grant usage on schema mika_internal to authenticated;
grant execute on function mika_internal.mfa_session_allowed() to authenticated;
do $$ declare t text; begin
 foreach t in array array['tasks','events','favorites','myka_conversations','myka_messages','plans'] loop
 execute format('alter policy mvp1_mfa_verified_session on public.%I using ((select mika_internal.mfa_session_allowed())) with check ((select mika_internal.mfa_session_allowed()))',t);
 end loop;
end $$;
