-- Immutable snapshot of a completed journey at the moment its achievement is saved.
-- No credits are issued by this migration or by achievement creation.
alter table public.myryra_journey_achievements
  add column if not exists completed_missions_at_achievement integer,
  add column if not exists myra_earned_at_achievement integer;

alter table public.myryra_journey_achievements
  add constraint achievement_completed_missions_nonnegative
    check (completed_missions_at_achievement is null or completed_missions_at_achievement >= 0),
  add constraint achievement_myra_earned_nonnegative
    check (myra_earned_at_achievement is null or myra_earned_at_achievement >= 0);

comment on column public.myryra_journey_achievements.completed_missions_at_achievement
  is 'Mission count when the achievement was created; null for historical records without a snapshot.';
comment on column public.myryra_journey_achievements.myra_earned_at_achievement
  is 'Sum of existing MYRA ledger credits for this journey at achievement creation; never issues credits.';
