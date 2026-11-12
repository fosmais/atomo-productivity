alter table public.myryra_journey_learning_progress
 add column if not exists assessment_score integer,
 add column if not exists assessment_passed boolean,
 add column if not exists assessment_attempts integer not null default 0,
 add column if not exists assessed_at timestamptz;
alter table public.myryra_journey_learning_progress
 add constraint journey_learning_score_range check (assessment_score is null or assessment_score between 0 and 100),
 add constraint journey_learning_attempts_nonnegative check (assessment_attempts >= 0),
 add constraint journey_learning_assessment_consistency check ((assessment_score is null and assessment_passed is null) or (assessment_score is not null and assessment_passed is not null));