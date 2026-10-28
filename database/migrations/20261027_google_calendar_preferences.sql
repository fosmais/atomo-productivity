-- VYRA 3.0
-- Preferencias de calendarios Google por usuario

create table if not exists public.google_calendar_preferences (
    user_id uuid primary key
        references auth.users(id) on delete cascade,

    selected_calendar_ids text[] not null default '{}',

    updated_at timestamptz not null default now(),

    constraint selected_calendar_ids_no_nulls
        check (array_position(selected_calendar_ids, null) is null)
);

alter table public.google_calendar_preferences
    enable row level security;

revoke all on table public.google_calendar_preferences
    from public, anon;

grant select, insert, update, delete
    on table public.google_calendar_preferences
    to authenticated;

drop policy if exists "Users can read own calendar preferences" on public.google_calendar_preferences;

create policy "Users can read own calendar preferences"
    on public.google_calendar_preferences
    for select
    to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own calendar preferences" on public.google_calendar_preferences;

create policy "Users can insert own calendar preferences"
    on public.google_calendar_preferences
    for insert
    to authenticated
    with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own calendar preferences" on public.google_calendar_preferences;

create policy "Users can update own calendar preferences"
    on public.google_calendar_preferences
    for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own calendar preferences" on public.google_calendar_preferences;

create policy "Users can delete own calendar preferences"
    on public.google_calendar_preferences
    for delete
    to authenticated
    using ((select auth.uid()) = user_id);

-- Ausencia de registro:
-- manter todos os calendarios atualmente considerados.
--
-- Registro com array vazio:
-- usuario desmarcou todos os calendarios.
--
-- A selecao sera validada pela aplicacao contra
-- os calendarios acessiveis na conta Google.
