-- MIKA Insights AI quotas. Applied to MVP2 preview only; review before production.
create schema if not exists mika_internal;
create table if not exists mika_internal.ai_quota (
 user_id uuid not null references auth.users(id) on delete cascade,
 action text not null check (action in ('suggest','transcribe')),
 window_start timestamptz not null,
 requests integer not null check (requests >= 0),
 primary key (user_id, action)
);
revoke all on schema mika_internal from public, anon, authenticated;
revoke all on all tables in schema mika_internal from public, anon, authenticated;
create or replace function public.mika_consume_ai_quota(p_action text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_limit integer; v_allowed integer;
begin
 if v_user is null or p_action not in ('suggest','transcribe') then return false; end if;
 v_limit := case p_action when 'suggest' then 12 when 'transcribe' then 20 end;
 insert into mika_internal.ai_quota(user_id,action,window_start,requests)
 values(v_user,p_action,now(),1)
 on conflict (user_id,action) do update set
  window_start=case when mika_internal.ai_quota.window_start <= now()-interval '1 hour' then now() else mika_internal.ai_quota.window_start end,
  requests=case when mika_internal.ai_quota.window_start <= now()-interval '1 hour' then 1 else mika_internal.ai_quota.requests+1 end
 where mika_internal.ai_quota.window_start <= now()-interval '1 hour'
    or mika_internal.ai_quota.requests < v_limit
 returning 1 into v_allowed;
 return coalesce(v_allowed = 1,false);
end $$;
revoke all on function public.mika_consume_ai_quota(text) from public, anon;
grant execute on function public.mika_consume_ai_quota(text) to authenticated;
