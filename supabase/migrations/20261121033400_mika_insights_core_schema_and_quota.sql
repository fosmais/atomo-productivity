create table if not exists public.mika_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 10000),
  title text,
  status text not null default 'captured' check (status in ('captured','analyzing','planned','archived')),
  source text not null default 'text' check (source in ('text','voice')),
  proposed_plan jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mika_ideas_user_created_idx on public.mika_ideas(user_id, created_at desc);
alter table public.mika_ideas enable row level security;
drop policy if exists "Users manage their own MIKA ideas" on public.mika_ideas;
create policy "Users manage their own MIKA ideas" on public.mika_ideas
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.mika_ideas to authenticated;

create schema if not exists mika_internal;
revoke all on schema mika_internal from public, anon, authenticated;
create table if not exists mika_internal.ai_quota (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('suggest','transcribe')),
  window_start timestamptz not null,
  requests integer not null default 0 check (requests >= 0),
  primary key (user_id, action)
);
alter table mika_internal.ai_quota enable row level security;
revoke all on mika_internal.ai_quota from public, anon, authenticated;

create or replace function public.mika_consume_ai_quota(p_action text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_limit integer;
  v_allowed integer;
begin
  if v_user is null or p_action not in ('suggest','transcribe') then
    return false;
  end if;
  v_limit := case p_action when 'suggest' then 12 when 'transcribe' then 20 end;
  insert into mika_internal.ai_quota(user_id,action,window_start,requests)
  values(v_user,p_action,now(),1)
  on conflict (user_id,action) do update
  set window_start = case
        when mika_internal.ai_quota.window_start <= now() - interval '1 hour' then now()
        else mika_internal.ai_quota.window_start end,
      requests = case
        when mika_internal.ai_quota.window_start <= now() - interval '1 hour' then 1
        else mika_internal.ai_quota.requests + 1 end
  where mika_internal.ai_quota.window_start <= now() - interval '1 hour'
     or mika_internal.ai_quota.requests < v_limit
  returning 1 into v_allowed;
  return coalesce(v_allowed = 1,false);
end;
$$;
revoke all on function public.mika_consume_ai_quota(text) from public, anon;
grant execute on function public.mika_consume_ai_quota(text) to authenticated;
