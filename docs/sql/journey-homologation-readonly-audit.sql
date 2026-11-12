-- MYRYRA Journey: read-only baseline verification for migration replay.
-- Run against a trusted database. Never run data-changing DDL on production
-- as part of migration diagnosis.
with required_tables(table_name) as (
  values ('events'), ('myryra_journeys'), ('myryra_journey_missions')
)
select t.table_name,
       to_regclass(format('public.%I',t.table_name)) is not null as exists_in_public,
       coalesce(c.relrowsecurity,false) as rls_enabled,
       count(a.attname) filter (where a.attnum>0 and not a.attisdropped) as column_count
from required_tables t
left join pg_namespace n on n.nspname='public'
left join pg_class c on c.relnamespace=n.oid and c.relname=t.table_name and c.relkind='r'
left join pg_attribute a on a.attrelid=c.oid
group by t.table_name,c.relrowsecurity
order by t.table_name;

select version,name,
       coalesce(array_length(statements,1),0) as statement_count
from supabase_migrations.schema_migrations
where name ilike '%journey%'
order by version;

select schemaname,tablename,policyname,cmd,roles
from pg_policies
where schemaname='public'
  and tablename in ('events','myryra_journeys','myryra_journey_missions')
order by tablename,policyname;

select n.nspname as schema_name,p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
('myryra_book_journey_lesson','myryra_create_journey_with_missions','myryra_confirm_journey_atomic')
order by p.proname;
