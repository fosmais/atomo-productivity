-- MYRYRA MVP2: STAGED ONLY. Review and test in isolated Supabase Sandbox.
-- Recover expired reconciliation leases. Never grant entitlements here.
-- A recovery attempt counts toward a bounded retry budget.
create or replace function public.recover_expired_asaas_reconciliation_jobs(
  p_limit integer default 10,
  p_max_attempts integer default 5
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recovered integer := 0;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Unauthorized reconciliation recovery';
  end if;
  if p_limit < 1 or p_limit > 100 or p_max_attempts < 1 or p_max_attempts > 20 then
    raise exception 'Invalid recovery limits';
  end if;

  -- SKIP LOCKED prevents competing recovery workers from selecting the same job.
  -- Completion is lease-fenced by locked_until and cannot succeed after expiry.
  with expired as (
    select id
    from public.billing_reconciliation_jobs
    where state = 'processing' and locked_until <= now()
    order by locked_until, id
    for update skip locked
    limit p_limit
  ), recovered as (
    update public.billing_reconciliation_jobs j
    set attempts = j.attempts + 1,
        state = case when j.attempts + 1 >= p_max_attempts then 'rejected' else 'retry' end,
        next_attempt_at = now() + make_interval(secs => least(3600, 60 * power(2::numeric, least(j.attempts, 5))::integer)),
        last_error_code = case when j.attempts + 1 >= p_max_attempts then 'LEASE_EXPIRED_MAX_RETRIES' else 'LEASE_EXPIRED' end,
        locked_until = null,
        updated_at = now()
    from expired
    where j.id = expired.id and j.state = 'processing' and j.locked_until <= now()
    returning j.id
  )
  select count(*)::integer into v_recovered from recovered;

  return v_recovered;
end;
$$;

revoke all on function public.recover_expired_asaas_reconciliation_jobs(integer,integer)
  from public, anon, authenticated;
grant execute on function public.recover_expired_asaas_reconciliation_jobs(integer,integer)
  to service_role;
