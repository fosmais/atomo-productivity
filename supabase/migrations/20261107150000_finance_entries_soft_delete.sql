-- MYRYRA Finance: recoverable deletion of manual entries.
-- Apply to staging first. Deploy frontend only after this migration is verified.
alter table public.myryra_finance_entries
  add column if not exists deleted_at timestamptz;

create index if not exists myryra_finance_entries_user_deleted_created_idx
  on public.myryra_finance_entries (user_id, deleted_at, created_at desc);

-- SELECT policy already restricts reads to the row owner.
-- UPDATE must independently enforce ownership before and after modification.
drop policy if exists finance_update_own on public.myryra_finance_entries;
create policy finance_update_own on public.myryra_finance_entries
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Once the application no longer uses hard DELETE, remove that privilege.
-- Until then, keep the existing DELETE policy for compatibility with the old release.
