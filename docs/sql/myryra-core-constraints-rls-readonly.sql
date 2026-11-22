-- Read-only core constraint and RLS policy inventory. No user data.
-- Capture outputs separately for PROD and each preview before drafting a baseline.
select c.relname as table_name, con.conname as constraint_name, con.contype as constraint_type,
       pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class c on c.oid=con.conrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
 ('plans','tasks','events','favorites','myka_conversations','myka_messages','google_calendar_connections')
order by c.relname,con.contype,con.conname;

select c.relname as table_name, c.relrowsecurity as rls_enabled,
       count(p.policyname) as policy_count
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
left join pg_policies p on p.schemaname=n.nspname and p.tablename=c.relname
where n.nspname='public' and c.relkind in ('r','p') and c.relname in
 ('plans','tasks','events','favorites','myka_conversations','myka_messages','google_calendar_connections')
group by c.relname,c.relrowsecurity order by c.relname;

select tablename,policyname,cmd,roles,qual,with_check
from pg_policies
where schemaname='public' and tablename in
 ('plans','tasks','events','favorites','myka_conversations','myka_messages','google_calendar_connections')
order by tablename,policyname;
