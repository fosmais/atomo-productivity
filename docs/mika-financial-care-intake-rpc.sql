-- STAGED: deploy only in isolated sandbox after applying mika-financial-care-schema.sql.
-- Atomic idempotent request + audit. Callable by service_role only.
create or replace function public.billing_financial_care_intake(
 p_user_id uuid, p_subscription_id uuid, p_action text,
 p_target_plan text, p_idempotency_key uuid, p_effective_at timestamptz
) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare v_id uuid; v_existing record; v_sub record;
begin
 if current_user <> 'service_role' then raise exception 'unauthorized'; end if;
 if p_action not in ('cancel_renewal','downgrade') or p_idempotency_key is null then raise exception 'invalid request'; end if;
 select id,action,target_plan,subscription_id into v_existing
 from public.billing_financial_care_requests
 where user_id=p_user_id and idempotency_key=p_idempotency_key;
 if found then
   if v_existing.action <> p_action or v_existing.target_plan is distinct from p_target_plan or v_existing.subscription_id <> p_subscription_id then
     raise exception 'idempotency conflict';
   end if;
   return v_existing.id;
 end if;
 select id,plan_id,status,provider,cancel_at_period_end,current_period_end into v_sub
 from public.billing_subscriptions where id=p_subscription_id and user_id=p_user_id for update;
 if not found or v_sub.provider <> 'asaas' or v_sub.status not in ('active','trialing') then raise exception 'ineligible subscription'; end if;
 -- A concurrent request may have committed while we waited on the subscription lock.
 -- Recheck the key under that lock before attempting the unique insert.
 select id,action,target_plan,subscription_id into v_existing
 from public.billing_financial_care_requests
 where user_id=p_user_id and idempotency_key=p_idempotency_key;
 if found then
   if v_existing.action <> p_action or v_existing.target_plan is distinct from p_target_plan or v_existing.subscription_id <> p_subscription_id then
     raise exception 'idempotency conflict';
   end if;
   return v_existing.id;
 end if;
 if p_action='cancel_renewal' and (p_target_plan is not null or v_sub.cancel_at_period_end) then raise exception 'invalid cancellation'; end if;
 if p_action='downgrade' and not (
 (v_sub.plan_id='premium' and p_target_plan in ('pro','free')) or
 (v_sub.plan_id='pro' and p_target_plan='free')
 ) then raise exception 'invalid downgrade'; end if;
 insert into public.billing_financial_care_requests
 (user_id,subscription_id,action,target_plan,idempotency_key,confirmed_at,effective_at)
 values (p_user_id,p_subscription_id,p_action,p_target_plan,p_idempotency_key,now(),v_sub.current_period_end)
 returning id into v_id;
 insert into public.billing_financial_care_audit(request_id,actor_id,event_type,new_status)
 values (v_id,p_user_id,'request_received','pending_review');
 return v_id;
end $$;
revoke all on function public.billing_financial_care_intake(uuid,uuid,text,text,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.billing_financial_care_intake(uuid,uuid,text,text,uuid,timestamptz) to service_role;
