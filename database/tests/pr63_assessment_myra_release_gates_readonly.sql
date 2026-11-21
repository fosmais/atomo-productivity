-- MYRYRA MVP2 PR #63 — read-only assessment and MYRA release gates.
-- Run independently in each environment. Expected: every gate is true.
-- This query changes no rows, grants, triggers or schema.
WITH gates AS (
 SELECT 'assessment_grade_update_revoked' AS gate,
   NOT has_column_privilege('authenticated','public.myryra_journey_learning_progress','assessment_passed','UPDATE')
   AND NOT has_column_privilege('authenticated','public.myryra_journey_learning_progress','assessment_score','UPDATE') AS passed
 UNION ALL
 SELECT 'assessment_grade_insert_revoked',
   NOT has_column_privilege('authenticated','public.myryra_journey_learning_progress','assessment_passed','INSERT')
   AND NOT has_column_privilege('authenticated','public.myryra_journey_learning_progress','assessment_score','INSERT')
 UNION ALL
 SELECT 'direct_mission_status_update_revoked',
   NOT has_column_privilege('authenticated','public.myryra_journey_missions','status','UPDATE')
 UNION ALL
 SELECT 'assessment_completion_trigger_present',
   EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='myryra_assessed_mission_completion_guard' AND NOT tgisinternal)
 UNION ALL
 SELECT 'completed_mission_insert_guard_present',
   EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='myryra_guard_completed_mission_insert' AND NOT tgisinternal)
 UNION ALL
 SELECT 'myra_ledger_direct_insert_revoked',
   NOT has_table_privilege('authenticated','public.myryra_journey_myra_ledger','INSERT')
 UNION ALL
 SELECT 'myra_ledger_direct_update_revoked',
   NOT has_table_privilege('authenticated','public.myryra_journey_myra_ledger','UPDATE')
)
SELECT gate,passed,CASE WHEN passed THEN 'PASS' ELSE 'BLOCK_RELEASE' END AS result
FROM gates ORDER BY gate;
