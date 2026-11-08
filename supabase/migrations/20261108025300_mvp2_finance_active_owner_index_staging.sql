-- Staging-only index inventory reconciliation. Already present in isolated DB.
-- Kept separate to preserve the exact applied Finance soft-delete migration.
CREATE INDEX IF NOT EXISTS finance_entries_active_owner_idx
 ON public.myryra_finance_entries (user_id, created_at DESC)
 WHERE deleted_at IS NULL;
