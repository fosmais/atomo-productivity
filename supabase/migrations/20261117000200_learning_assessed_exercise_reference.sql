-- Bind future assessment evidence to an immutable server-assigned exercise.
-- Additive rollout: existing legacy grades remain readable; API and completion
-- trigger enforcement must be deployed together before requiring this evidence.
alter table public.myryra_journey_learning_progress
  add column if not exists assessed_exercise_id uuid
    references public.myryra_journey_assigned_exercises(id) on delete set null;
create index if not exists myryra_learning_assessed_exercise_idx
  on public.myryra_journey_learning_progress(assessed_exercise_id)
  where assessed_exercise_id is not null;
