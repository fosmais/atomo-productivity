-- Staged migration. Apply only after review and Asaas Sandbox setup.
-- Enqueue only verified-token webhook receipts. This is not proof of payment.
create or replace function public.enqueue_asaas_reconciliation_event(
  p_event_id text, p_event_type text, p_payment_id text
) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare v_id bigint;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Unauthorized'; end if;
  if p_event_id !~ '^[A-Za-z0-9_-]{1,128}$'
     or p_event_type !~ '^PAYMENT_[A-Z_]{1,90}$'
     or p_payment_id !~ '^[A-Za-z0-9_-]{1,100}$' then
    raise exception 'Invalid event';
  end if;
  insert into public.billing_reconciliation_jobs
    (provider, provider_event_id, event_type, provider_payment_id)
  values ('asaas', p_event_id, p_event_type, p_payment_id)
  on conflict (provider, provider_event_id) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.billing_reconciliation_jobs
    where provider = 'asaas' and provider_event_id = p_event_id;
  end if;
  return v_id;
end;
$$;

revoke all on function public.enqueue_asaas_reconciliation_event(text,text,text)
  from public, anon, authenticated;
grant execute on function public.enqueue_asaas_reconciliation_event(text,text,text) to service_role;

-- An idempotent worker must provide the current lease and state, and
-- must not be able to transition a completed/rejected job back to pending.
create or replace function public.complete_asaas_reconciliation_job(
  p_job_id bigint, p_expected_locked_until timestamptz,
  p_state text, p_attempts integer, p_next_attempt_at timestamptz,
  p_error_code text default null
) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_updated bigint;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Unauthorized'; end if;
  if p_state not in ('verified','rejected','retry')
    or p_attempts < 0 or p_attempts > 20
    or (p_state = 'retry' and p_next_attempt_at is null) then
    raise exception 'Invalid completion';
  end if;
  update public.billing_reconciliation_jobs
  set state = p_state,
      attempts = p_attempts,
      next_attempt_at = coalesce(p_next_attempt_at, next_attempt_at),
      last_error_code = left(p_error_code, 100),
      locked_until = null,
      updated_at = now()
  where id = p_job_id and state = 'processing'
    and locked_until = p_expected_locked_until
    and locked_until > now()
  returning id into v_updated;
  return v_updated is not null;
end;
$$;

revoke all on function public.complete_asaas_reconciliation_job(bigint,timestamptz,text,integer,timestamptz,text)
  from public, anon, authenticated;
grant execute on function public.complete_asaas_reconciliation_job(bigint,timestamptz,text,integer,timestamptz,text)
  to service_role;
