-- Isolated staging only. Preserve finance_entries_active_owner_idx (same definition).
-- Do not place this migration in supabase/migrations or apply to production.
DROP INDEX IF EXISTS public.myryra_finance_entries_user_active_idx;
