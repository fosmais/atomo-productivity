-- MYRYRA MVP1 support schema proposal. REVIEW and apply to a non-production Supabase environment first.
-- This file is deliberately not an auto-applied migration.
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (char_length(subject) between 3 and 200),
  description text not null check (char_length(description) between 10 and 3000),
  module text not null default 'home',
  category text not null default 'general' check (category in ('general','account','integration','calendar','tasks','billing','bug')),
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  status text not null default 'open' check (status in ('open','triage','in_progress','waiting_user','resolved','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_tickets_user_created_idx on public.support_tickets(user_id,created_at desc);
create index if not exists support_tickets_status_priority_idx on public.support_tickets(status,priority,created_at desc);
alter table public.support_tickets enable row level security;
revoke all on public.support_tickets from anon;
grant select,insert on public.support_tickets to authenticated;
create policy "support_tickets_owner_select" on public.support_tickets for select to authenticated using ((select auth.uid()) = user_id);
create policy "support_tickets_owner_insert" on public.support_tickets for insert to authenticated with check ((select auth.uid()) = user_id and status = 'open' and priority = 'normal');

-- Administrative rights are granted via a server-managed allowlist, never user_metadata.
create table if not exists public.support_agents (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.support_agents enable row level security;
revoke all on public.support_agents from anon,authenticated;

create table if not exists public.support_ticket_updates (
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 author_id uuid not null references auth.users(id),
 body text not null check (char_length(body) between 1 and 3000),
 visible_to_user boolean not null default true,
 created_at timestamptz not null default now()
);
create index if not exists support_ticket_updates_ticket_idx on public.support_ticket_updates(ticket_id,created_at);
alter table public.support_ticket_updates enable row level security;
revoke all on public.support_ticket_updates from anon;
grant select on public.support_ticket_updates to authenticated;
create policy "support_updates_owner_read" on public.support_ticket_updates for select to authenticated
using (visible_to_user and exists (select 1 from public.support_tickets t where t.id=ticket_id and t.user_id=(select auth.uid())));

create table if not exists public.support_notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 title text not null,
 body text not null,
 read_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.support_notifications enable row level security;
revoke all on public.support_notifications from anon;
grant select,update on public.support_notifications to authenticated;
create policy "support_notifications_owner_select" on public.support_notifications for select to authenticated using ((select auth.uid())=user_id);
create policy "support_notifications_owner_update" on public.support_notifications for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

create table if not exists public.support_knowledge (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 content text not null,
 category text not null default 'general',
 published boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.support_knowledge enable row level security;
revoke all on public.support_knowledge from anon;
grant select on public.support_knowledge to authenticated;
create policy "support_knowledge_published_read" on public.support_knowledge for select to authenticated using (published);

-- No client-side admin writes. Administrative API must check support_agents using a server-only credential.
-- Do not insert agents or expose service_role keys to the browser.
