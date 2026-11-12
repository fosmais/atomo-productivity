alter table public.myryra_finance_delivery_log
 add column if not exists next_attempt_at timestamptz,
 add column if not exists last_error text,
 add column if not exists sent_at timestamptz,
 add column if not exists updated_at timestamptz not null default now();
alter table public.myryra_finance_delivery_log
 drop constraint if exists myryra_finance_delivery_log_status_check;
alter table public.myryra_finance_delivery_log
 add constraint myryra_finance_delivery_log_status_check
 check(status in ('pending','processing','sent','failed','cancelled'));
alter table public.myryra_finance_delivery_log
 add constraint finance_delivery_attempts_nonnegative check(attempts >= 0);
create index if not exists finance_delivery_queue_ready_idx
 on public.myryra_finance_delivery_log(next_attempt_at,created_at)
 where status in ('pending','failed') and attempts < 3;
revoke insert,update,delete on public.myryra_finance_delivery_log from authenticated,anon;