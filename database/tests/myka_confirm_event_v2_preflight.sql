-- MYRYRA Concierge V2 — read-only release preflight.
-- Run on staging and production BEFORE applying the V2 migration.
-- All rows should return ready=true, except v2_not_installed, which should
-- return ready=true before deployment and false after deployment.
select 'messages_table' as check_name,
       to_regclass('public.myka_messages') is not null as ready
union all
select 'events_table', to_regclass('public.events') is not null
union all
select 'event_status_column', exists (
  select 1 from information_schema.columns
  where table_schema='public' and table_name='myka_messages'
    and column_name='event_status')
union all
select 'proposed_event_column', exists (
  select 1 from information_schema.columns
  where table_schema='public' and table_name='myka_messages'
    and column_name='proposed_event' and data_type='jsonb')
union all
select 'events_time_columns', (
  select count(*) = 2 from information_schema.columns
  where table_schema='public' and table_name='events'
    and column_name in ('starts_at','ends_at')
    and data_type='timestamp with time zone')
union all
select 'v2_not_installed',
  to_regprocedure('public.myka_confirm_event_v2(uuid,uuid,boolean)') is null;
