-- MYRYRA RLS isolation smoke test. Does not persist changes.
-- Simulated authenticated user without any owned rows.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$
declare n bigint;
begin
  select count(*) into n from public.plans;
  if n <> 0 then raise exception 'RLS FAILED plans: % rows',n; end if;
  select count(*) into n from public.tasks;
  if n <> 0 then raise exception 'RLS FAILED tasks: % rows',n; end if;
  select count(*) into n from public.events;
  if n <> 0 then raise exception 'RLS FAILED events: % rows',n; end if;
  select count(*) into n from public.myka_conversations;
  if n <> 0 then raise exception 'RLS FAILED conversations: % rows',n; end if;
  select count(*) into n from public.myka_messages;
  if n <> 0 then raise exception 'RLS FAILED messages: % rows',n; end if;
  select count(*) into n from public.myka_task_confirmations;
  if n <> 0 then raise exception 'RLS FAILED confirmations: % rows',n; end if;
end $$;
rollback;
