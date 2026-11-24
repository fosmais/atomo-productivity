-- MVP1 release gate: inspect MFA assurance at the Data API/RLS boundary.
-- Read-only. Run in Supabase SQL Editor; it does not modify user data.
-- A zero in aal_policy_count is a security review finding, not proof of exploitation.
select
  tablename,
  count(*) as policy_count,
  count(*) filter (
    where coalesce(qual, '') ~* '(aal|mfa)'
       or coalesce(with_check, '') ~* '(aal|mfa)'
  ) as policies_with_explicit_mfa_reference
from pg_policies
where schemaname = 'public'
  and tablename in (
    'plans', 'tasks', 'events', 'favorites',
    'myka_conversations', 'myka_messages'
  )
group by tablename
order by tablename;

-- IMPORTANT: An MFA helper referenced by another name may not match this
-- textual audit. Inspect actual policy expressions and test with a real
-- AAL1 session belonging to an enrolled MFA user before approving release.
-- AAL1 must not read/write protected data for that user if MFA is mandatory.
-- AAL2 must retain the expected user-owned access; other users remain denied.
