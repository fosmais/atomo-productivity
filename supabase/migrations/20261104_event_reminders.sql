-- MYRYRA reminders foundation. Versioned migration: do not apply to production without staging validation.
create table if not exists public.event_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  minutes_before integer not null check (minutes_before between 0 and 10080),
  channel text not null default 'in_app' check (channel in ('in_app')),
  remind_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','sent','cancelled')),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, channel, minutes_before)
);
create index if not exists event_reminders_pending_idx
  on public.event_reminders (remind_at) where status = 'pending';
create index if not exists event_reminders_user_idx
  on public.event_reminders (user_id, remind_at);
alter table public.event_reminders enable row level security;
drop policy if exists "Users can view own event reminders" on public.event_reminders;
create policy "Users can view own event reminders"
  on public.event_reminders for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "Users can create own event reminders" on public.event_reminders;
create policy "Users can create own event reminders"
  on public.event_reminders for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.events e
      where e.id = event_id and e.user_id = (select auth.uid()) and e.deleted_at is null
        and e.starts_at > now()
        and remind_at = e.starts_at - (minutes_before * interval '1 minute')
    )
  );
drop policy if exists "Users can cancel own event reminders" on public.event_reminders;
create policy "Users can cancel own event reminders"
  on public.event_reminders for update to authenticated
  using (user_id = (select auth.uid()) and status = 'pending')
  with check (user_id = (select auth.uid()) and status = 'cancelled');
-- Delivery worker must use service role and perform idempotent status transitions.
-- Do not expose direct client-side ability to mark reminders sent.
