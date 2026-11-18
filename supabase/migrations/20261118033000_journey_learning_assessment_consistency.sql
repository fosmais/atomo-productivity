-- Preserve the production invariant in environments that lack it.
-- Staging was corrected manually; production already has this constraint.
-- This migration is idempotent by constraint name and does not drop data.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.myryra_journey_learning_progress'::regclass
      and conname = 'journey_learning_assessment_consistency'
  ) then
    alter table public.myryra_journey_learning_progress
      add constraint journey_learning_assessment_consistency
      check (
        (assessment_score is null and assessment_passed is null)
        or (assessment_score is not null and assessment_passed is not null)
      );
  end if;
end;
$$;
