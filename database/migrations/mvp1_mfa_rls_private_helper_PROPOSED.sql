-- MYRYRA MVP1 — proposta de MFA RLS. NAO EXECUTAR SEM TESTES AAL1/AAL2.
-- Depende de execucao pelo owner com acesso a auth.mfa_factors.
-- SECURITY DEFINER reduz a exposicao de auth.mfa_factors: retorna apenas boolean.
begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.mfa_session_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and coalesce(auth.jwt()->>'aal', '') in ('aal1','aal2')
     and (
       not exists (
         select 1 from auth.mfa_factors f
         where f.user_id = auth.uid() and f.status = 'verified'
       )
       or auth.jwt()->>'aal' = 'aal2'
     );
$$;

revoke all on function private.mfa_session_allowed() from public, anon;
grant execute on function private.mfa_session_allowed() to authenticated;

-- Restrictive policies compose with existing per-user policies.
-- Do not create a new permissive access path.
create policy mvp1_mfa_verified_session on public.plans
  as restrictive for all to authenticated
  using ((select private.mfa_session_allowed()))
  with check ((select private.mfa_session_allowed()));
create policy mvp1_mfa_verified_session on public.tasks
  as restrictive for all to authenticated
  using ((select private.mfa_session_allowed()))
  with check ((select private.mfa_session_allowed()));
create policy mvp1_mfa_verified_session on public.events
  as restrictive for all to authenticated
  using ((select private.mfa_session_allowed()))
  with check ((select private.mfa_session_allowed()));
create policy mvp1_mfa_verified_session on public.favorites
  as restrictive for all to authenticated
  using ((select private.mfa_session_allowed()))
  with check ((select private.mfa_session_allowed()));
create policy mvp1_mfa_verified_session on public.myka_conversations
  as restrictive for all to authenticated
  using ((select private.mfa_session_allowed()))
  with check ((select private.mfa_session_allowed()));
create policy mvp1_mfa_verified_session on public.myka_messages
  as restrictive for all to authenticated
  using ((select private.mfa_session_allowed()))
  with check ((select private.mfa_session_allowed()));

-- RPCs SECURITY DEFINER require an explicit guard too. RLS alone
-- does not protect calls to myka_confirm_task_item / myka_cancel_task_item.
-- Do not release until both RPCs are patched and tested.

commit;
