-- Verified on isolated staging; review before production application.
begin;
alter policy event_concierge_update_own on public.event_concierge
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.events e where e.id = event_id and e.user_id = (select auth.uid()) and e.deleted_at is null));
revoke all on public.event_concierge from public,anon;
commit;
