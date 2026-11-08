-- Staged migration: apply to isolated test environment before Preview.
create table if not exists public.microsoft_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_access_token text not null,
  encrypted_refresh_token text,
  token_expires_at timestamptz,
  scope text not null default 'Calendars.Read',
  updated_at timestamptz not null default now()
);
alter table public.microsoft_connections enable row level security;
revoke all on public.microsoft_connections from anon, authenticated;
-- No client policies: access restricted to server-side service role.
