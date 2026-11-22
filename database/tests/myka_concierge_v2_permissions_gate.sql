-- Read-only release gate for MIKA Concierge V2.
-- Expected: both functions present, SECURITY INVOKER, executable by service_role only.
select p.proname as function_name,
       not p.prosecdef as security_invoker,
       has_function_privilege('service_role',p.oid,'execute') as service_role_can_execute,
       not has_function_privilege('anon',p.oid,'execute') as anon_blocked,
       not has_function_privilege('authenticated',p.oid,'execute') as authenticated_blocked
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in ('myka_confirm_event_v2','myka_cancel_event_v2')
order by p.proname;
-- Gate: exactly two rows, all boolean columns true.
