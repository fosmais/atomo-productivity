-- MYRYRA Finance: reversible deletion and owner-scoped edits.
-- Apply only after staging validation; frontend trash remains feature-flagged.
alter table public.myryra_finance_entries
  add column if not exists deleted_at timestamptz;

create index if not exists myryra_finance_entries_user_deleted_created_idx
  on public.myryra_finance_entries (user_id, deleted_at, created_at desc);

-- Authenticated clients may edit only fields used by the wallet UI.
revoke update on public.myryra_finance_entries from authenticated;
grant update (description, amount_cents, kind, deleted_at)
  on public.myryra_finance_entries to authenticated;

drop policy if exists finance_update_own on public.myryra_finance_entries;
create policy finance_update_own on public.myryra_finance_entries
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Keep the existing DELETE policy during the compatibility window:
-- older deployments still perform hard deletes while the feature flag is off.
