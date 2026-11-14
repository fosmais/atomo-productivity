-- Homologation only: restore Journey missions and pedagogical progress.
-- Do not apply to production. Requires public.myryra_journeys.
begin;
create table if not exists public.myryra_journey_missions (
 id uuid primary key default gen_random_uuid(),
 journey_id uuid not null references public.myryra_journeys(id) on delete cascade,
 title text not null check (char_length(btrim(title)) between 1 and 160),
 status text not null default 'pending' check (status in ('pending','completed')),
 due_at timestamptz,
 completed_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists myryra_journey_missions_journey_idx on public.myryra_journey_missions(journey_id);
alter table public.myryra_journey_missions enable row level security;
create policy missions_select_owner on public.myryra_journey_missions for select to authenticated using (exists(select 1 from public.myryra_journeys j where j.id=journey_id and j.owner_id=(select auth.uid())));
create policy missions_insert_owner on public.myryra_journey_missions for insert to authenticated with check (exists(select 1 from public.myryra_journeys j where j.id=journey_id and j.owner_id=(select auth.uid())));
create policy missions_update_owner on public.myryra_journey_missions for update to authenticated using (exists(select 1 from public.myryra_journeys j where j.id=journey_id and j.owner_id=(select auth.uid()))) with check (exists(select 1 from public.myryra_journeys j where j.id=journey_id and j.owner_id=(select auth.uid())));
create policy missions_delete_owner on public.myryra_journey_missions for delete to authenticated using (exists(select 1 from public.myryra_journeys j where j.id=journey_id and j.owner_id=(select auth.uid())));

create table if not exists public.myryra_journey_learning_progress (
 mission_id uuid primary key references public.myryra_journey_missions(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 answer text not null default '' check(char_length(answer)<=2000),
 feedback text check(feedback is null or char_length(feedback)<=5000),
 updated_at timestamptz not null default now(),
 assessment_score integer check(assessment_score between 0 and 100),
 assessment_passed boolean,
 assessment_attempts integer not null default 0 check(assessment_attempts>=0),
 assessed_at timestamptz
);
create table if not exists public.myryra_journey_review_steps (
 mission_id uuid primary key references public.myryra_journey_missions(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 steps jsonb not null default '[false,false,false]'::jsonb check(jsonb_typeof(steps)='array' and jsonb_array_length(steps)=3 and jsonb_typeof(steps->0)='boolean' and jsonb_typeof(steps->1)='boolean' and jsonb_typeof(steps->2)='boolean'),
 updated_at timestamptz not null default now()
);
alter table public.myryra_journey_learning_progress enable row level security;
alter table public.myryra_journey_review_steps enable row level security;
create policy journey_learning_owner_select on public.myryra_journey_learning_progress for select to authenticated using(owner_id=(select auth.uid()) and exists(select 1 from public.myryra_journey_missions m join public.myryra_journeys j on j.id=m.journey_id where m.id=mission_id and j.owner_id=(select auth.uid())));
create policy journey_learning_owner_insert on public.myryra_journey_learning_progress for insert to authenticated with check(owner_id=(select auth.uid()) and exists(select 1 from public.myryra_journey_missions m join public.myryra_journeys j on j.id=m.journey_id where m.id=mission_id and j.owner_id=(select auth.uid())));
create policy journey_learning_owner_update on public.myryra_journey_learning_progress for update to authenticated using(owner_id=(select auth.uid()) and exists(select 1 from public.myryra_journey_missions m join public.myryra_journeys j on j.id=m.journey_id where m.id=mission_id and j.owner_id=(select auth.uid()))) with check(owner_id=(select auth.uid()) and exists(select 1 from public.myryra_journey_missions m join public.myryra_journeys j on j.id=m.journey_id where m.id=mission_id and j.owner_id=(select auth.uid())));
create policy journey_learning_owner_delete on public.myryra_journey_learning_progress for delete to authenticated using(owner_id=(select auth.uid()));
create policy journey_review_steps_owner_select on public.myryra_journey_review_steps for select to authenticated using(owner_id=(select auth.uid()) and exists(select 1 from public.myryra_journey_missions m join public.myryra_journeys j on j.id=m.journey_id where m.id=mission_id and j.owner_id=(select auth.uid())));
create policy journey_review_steps_owner_insert on public.myryra_journey_review_steps for insert to authenticated with check(owner_id=(select auth.uid()) and exists(select 1 from public.myryra_journey_missions m join public.myryra_journeys j on j.id=m.journey_id where m.id=mission_id and j.owner_id=(select auth.uid())));
create policy journey_review_steps_owner_update on public.myryra_journey_review_steps for update to authenticated using(owner_id=(select auth.uid()) and exists(select 1 from public.myryra_journey_missions m join public.myryra_journeys j on j.id=m.journey_id where m.id=mission_id and j.owner_id=(select auth.uid()))) with check(owner_id=(select auth.uid()) and exists(select 1 from public.myryra_journey_missions m join public.myryra_journeys j on j.id=m.journey_id where m.id=mission_id and j.owner_id=(select auth.uid())));
-- RLS does not grant table access; authenticated needs explicit privileges.
grant select, insert, update, delete on public.myryra_journey_missions to authenticated;
grant select, insert, update, delete on public.myryra_journey_learning_progress to authenticated;
grant select, insert, update on public.myryra_journey_review_steps to authenticated;
commit;
