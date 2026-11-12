-- MYRYRA: read-only, schema-only catalog export for initial bootstrap recovery.
-- Returns DDL fragments for human review; NEVER execute generated output
-- automatically against production or a new branch.
-- No table rows, auth.users records, secrets or API keys are selected.
with app_tables as (
  select c.oid, n.nspname, c.relname
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p')
    and c.relname in ('plans','tasks','events','myryra_journeys','myryra_journey_missions')
)
select t.relname as table_name, a.attnum as ordinal,
       a.attname as column_name,
       format_type(a.atttypid,a.atttypmod) as data_type,
       a.attnotnull as not_null,
       pg_get_expr(d.adbin,d.adrelid) as default_expression,
       case when a.attidentity <> '' then a.attidentity else null end as identity_kind
from app_tables t
join pg_attribute a on a.attrelid=t.oid and a.attnum>0 and not a.attisdropped
left join pg_attrdef d on d.adrelid=t.oid and d.adnum=a.attnum
order by t.relname,a.attnum;

with app_tables as (
  select c.oid,c.relname from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname in
    ('plans','tasks','events','myryra_journeys','myryra_journey_missions')
)
select t.relname as table_name, con.conname as constraint_name,
       pg_get_constraintdef(con.oid,true) as constraint_definition
from app_tables t join pg_constraint con on con.conrelid=t.oid
order by t.relname,con.conname;

select tablename,indexname,indexdef from pg_indexes
where schemaname='public' and tablename in
('plans','tasks','events','myryra_journeys','myryra_journey_missions')
order by tablename,indexname;

select tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where schemaname='public' and tablename in
('plans','tasks','events','myryra_journeys','myryra_journey_missions')
order by tablename,policyname;

select c.relname as table_name,c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as force_rls
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
('plans','tasks','events','myryra_journeys','myryra_journey_missions')
order by c.relname;
