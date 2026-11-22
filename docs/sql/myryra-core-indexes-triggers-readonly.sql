-- Read-only inventory of indexes, triggers and trigger-function source for
-- foundational MYRYRA tables. Run against PROD and previews before reconstructing.
select tablename,indexname,indexdef
from pg_indexes
where schemaname='public' and tablename in
 ('plans','tasks','events','favorites','myka_conversations','myka_messages','google_calendar_connections')
order by tablename,indexname;

select event_object_table as table_name,trigger_name,event_manipulation,
       action_timing,action_statement
from information_schema.triggers
where trigger_schema='public' and event_object_table in
 ('plans','tasks','events','favorites','myka_conversations','myka_messages','google_calendar_connections')
order by event_object_table,trigger_name,event_manipulation;

select p.proname,pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='myryra_guard_blocking_event_overlap';
