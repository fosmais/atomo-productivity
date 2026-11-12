alter table public.myryra_finance_alert_preferences
 add column if not exists email_enabled boolean not null default false,
 add column if not exists push_enabled boolean not null default false,
 add column if not exists daily_digest_enabled boolean not null default false;