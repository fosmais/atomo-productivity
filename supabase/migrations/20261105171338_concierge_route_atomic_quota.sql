create table if not exists public.concierge_route_usage (
  usage_day date not null,
  user_id uuid not null,
  requests integer not null default 0,
  last_request_at timestamptz not null default now(),
  primary key (usage_day, user_id)
);
alter table public.concierge_route_usage enable row level security;
revoke all on public.concierge_route_usage from anon, authenticated;
create or replace function public.reserve_concierge_route_request(p_user_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_day date := (now() at time zone 'UTC')::date;
v_user_count integer;
v_global_count bigint;
v_last timestamptz;
begin
 if p_user_id is null then return 'INVALID_USER'; end if;
 perform pg_advisory_xact_lock(619822, (v_day - date '2000-01-01')::integer);
 select requests, last_request_at into v_user_count, v_last
 from public.concierge_route_usage where usage_day=v_day and user_id=p_user_id;
 if coalesce(v_user_count,0) >= 10 then return 'USER_DAILY_LIMIT'; end if;
 if v_last is not null and v_last > now()-interval '60 seconds' then return 'RATE_LIMIT'; end if;
 select coalesce(sum(requests),0) into v_global_count from public.concierge_route_usage where usage_day=v_day;
 if v_global_count >= 300 then return 'GLOBAL_DAILY_LIMIT'; end if;
 insert into public.concierge_route_usage(usage_day,user_id,requests,last_request_at)
 values(v_day,p_user_id,1,now())
 on conflict (usage_day,user_id) do update
 set requests=public.concierge_route_usage.requests+1,last_request_at=now();
 return 'OK';
end $$;
revoke all on function public.reserve_concierge_route_request(uuid) from public, anon, authenticated;
grant execute on function public.reserve_concierge_route_request(uuid) to service_role;