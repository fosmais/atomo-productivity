-- Staged only. Review before applying to any Supabase environment.
-- Claim a single due job atomically to prevent concurrent workers from double processing.
create or replace function public.claim_asaas_reconciliation_job(p_lease_seconds integer default 120)
returns setof public.billing_reconciliation_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed public.billing_reconciliation_jobs%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Unauthorized reconciliation claim';
  end if;
  if p_lease_seconds < 30 or p_lease_seconds > 600 then
    raise exception 'Invalid lease duration';
  end if;
  with candidate as (
    select id
    from public.billing_reconciliation_jobs
    where state in ('pending', 'retry')
      and next_attempt_at <= now()
      and (locked_until is null or locked_until <= now())
    order by next_attempt_at, id
    for update skip locked
    limit 1
  )
  update public.billing_reconciliation_jobs j
  set state = 'processing',
      locked_until = now() + make_interval(secs => p_lease_seconds),
      updated_at = now()
  from candidate
  where j.id = candidate.id
  returning j.* into claimed;

  if found then return next claimed; end if;
  return;
end;
$$;

revoke all on function public.claim_asaas_reconciliation_job(integer) from public, anon, authenticated;
grant execute on function public.claim_asaas_reconciliation_job(integer) to service_role;

-- An expired processing lease needs a separately audited recovery transition.
-- Do not automatically reset processing jobs without confirming idempotency.
