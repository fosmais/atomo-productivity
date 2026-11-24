-- Allow authenticated owners to change event categories.
-- This migration accompanies 20261104_event_categories.sql.
grant select on public.events to authenticated;
grant update (category) on public.events to authenticated;
drop policy if exists events_owner_update_category on public.events;
create policy events_owner_update_category on public.events
  for update to authenticated
  using ((select auth.uid()) = user_id and deleted_at is null)
  with check ((select auth.uid()) = user_id and deleted_at is null);
