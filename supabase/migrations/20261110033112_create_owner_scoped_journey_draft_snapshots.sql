create table if not exists public.myryra_journey_draft_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  draft jsonb not null check (jsonb_typeof(draft) = 'object'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint journey_snapshot_expiry_window check (
    expires_at > created_at and expires_at <= created_at + interval '16 minutes'
  )
);
create index if not exists journey_snapshot_owner_expiry_idx
  on public.myryra_journey_draft_snapshots(owner_id, expires_at);
alter table public.myryra_journey_draft_snapshots enable row level security;
revoke all on public.myryra_journey_draft_snapshots from anon, authenticated;
grant select, insert on public.myryra_journey_draft_snapshots to authenticated;
create policy "journey_snapshot_select_owner_unexpired"
  on public.myryra_journey_draft_snapshots for select to authenticated
  using (owner_id = (select auth.uid()) and expires_at > now());
create policy "journey_snapshot_insert_owner_short_lived"
  on public.myryra_journey_draft_snapshots for insert to authenticated
  with check (owner_id = (select auth.uid())
    and expires_at > now()
    and expires_at <= now() + interval '16 minutes');
