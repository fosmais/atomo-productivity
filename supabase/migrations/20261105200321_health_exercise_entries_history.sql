create table if not exists public.myryra_health_exercise_entries (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 exercise_name text not null check (char_length(exercise_name) between 1 and 120),
 muscle_group text not null check (muscle_group in ('Peito','Costas','Braços','Ombros','Pernas','Abdômen')),
 routine text not null check (routine in ('Livre','A','B','C')),
 level text not null check (level in ('Iniciante','Intermediário','Avançado')),
 weight_kg numeric(7,2) check (weight_kg between 0 and 1000),
 repetitions integer check (repetitions between 0 and 100),
 performed_on date not null default current_date,
 created_at timestamptz not null default now()
);
create index if not exists myryra_health_exercise_entries_owner_date on public.myryra_health_exercise_entries(user_id,performed_on desc);
alter table public.myryra_health_exercise_entries enable row level security;
create policy "owner read exercise entries" on public.myryra_health_exercise_entries for select to authenticated using ((select auth.uid())=user_id);
create policy "owner add exercise entries" on public.myryra_health_exercise_entries for insert to authenticated with check ((select auth.uid())=user_id);
create policy "owner delete exercise entries" on public.myryra_health_exercise_entries for delete to authenticated using ((select auth.uid())=user_id);
grant select,insert,delete on public.myryra_health_exercise_entries to authenticated;