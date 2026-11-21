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
  usage_count integer not null default 0 check (usage_count >= 0),
  primary key (user_id, action, window_start)
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
  v_user_id uuid := auth.uid();
  v_limit integer;
  v_window timestamptz := date_trunc('hour', now());
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_action = 'suggest' then
    v_limit := 12;
  elsif p_action = 'transcribe' then
    v_limit := 20;
  else
    raise exception 'invalid action' using errcode = '22023';
  end if;
  insert into mika_internal.ai_quota(user_id, action, window_start, usage_count)
  values (v_user_id, p_action, v_window, 1)
  on conflict (user_id, action, window_start)
  do update set usage_count = mika_internal.ai_quota.usage_count + 1
    where mika_internal.ai_quota.usage_count < v_limit
  returning usage_count into v_count;
  return v_count is not null;
end;
$$;
revoke all on function public.mika_consume_ai_quota(text) from public, anon;
grant execute on function public.mika_consume_ai_quota(text) to authenticated;
