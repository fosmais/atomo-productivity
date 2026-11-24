-- Candidate only: do not apply before approval and publication of health_storage.
-- Restrictive policies supplement existing ownership policies.
begin;
create function public.myryra_health_storage_allowed() returns boolean
language sql stable security invoker set search_path = '' as $$
 select coalesce((select not p.required and p.legal_basis='consent' and
 coalesce((select c.granted from public.myryra_privacy_choices c
 where c.user_id=(select auth.uid()) and c.purpose_key=p.purpose_key
 and c.purpose_version=p.purpose_version
 order by c.occurred_at desc,c.granted asc limit 1),false)
 from public.myryra_privacy_purposes p where p.purpose_key='health_storage'
 and p.active order by p.purpose_version desc limit 1),false)
$$;
revoke all on function public.myryra_health_storage_allowed() from public,anon;
grant execute on function public.myryra_health_storage_allowed() to authenticated;
create policy health_storage_consent_insert on public.myryra_health_profiles as restrictive for insert to authenticated with check ((select public.myryra_health_storage_allowed()));
create policy health_storage_consent_update on public.myryra_health_profiles as restrictive for update to authenticated using ((select public.myryra_health_storage_allowed())) with check ((select public.myryra_health_storage_allowed()));
create policy health_storage_consent_insert on public.myryra_health_logs as restrictive for insert to authenticated with check ((select public.myryra_health_storage_allowed()));
create policy health_storage_consent_update on public.myryra_health_logs as restrictive for update to authenticated using ((select public.myryra_health_storage_allowed())) with check ((select public.myryra_health_storage_allowed()));
create policy health_storage_consent_insert on public.myryra_health_exercise_entries as restrictive for insert to authenticated with check ((select public.myryra_health_storage_allowed()));
create policy health_storage_consent_update on public.myryra_health_exercise_entries as restrictive for update to authenticated using ((select public.myryra_health_storage_allowed())) with check ((select public.myryra_health_storage_allowed()));
commit;
