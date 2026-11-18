-- ISSUE #61: CANDIDATE ONLY; do not execute without review and release authorization.
-- Read-only inspection on staging showed authenticated SELECT and service_role
-- REFERENCES/TRIGGER/TRUNCATE, but no explicit service_role INSERT or SELECT.
-- A service-role client may have elevated database behavior; test actual runtime
-- permissions before deciding whether these grants are necessary.
-- Intentionally outside supabase/migrations to prevent automatic application.

begin;
do $preflight$
begin
  if to_regclass('public.myryra_journey_assigned_exercises') is null then
    raise exception 'Missing assigned exercises table';
  end if;
  if to_regprocedure('public.myryra_validate_assigned_exercise()') is null then
    raise exception 'Missing validation trigger function';
  end if;
end;
$preflight$;

-- Proposed least-privilege grants for a reviewed server-only issuer.
-- No INSERT/UPDATE/DELETE privileges for authenticated or anon.
grant select, insert on public.myryra_journey_assigned_exercises to service_role;

-- Intentionally no UPDATE: exercises are immutable by trigger.
-- Intentionally no DELETE: avoid destroying official assessment history.
commit;

-- Rollback if specifically authorized:
-- revoke insert on public.myryra_journey_assigned_exercises from service_role;
-- SELECT may be needed by existing server reads; assess separately before revoking.
