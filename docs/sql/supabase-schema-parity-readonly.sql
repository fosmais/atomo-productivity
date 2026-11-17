-- MYRYRA Supabase schema parity smoke test (READ ONLY).
-- Run independently in production and disposable preview; compare result sets.
-- Never execute as a migration; does not inspect user records.
-- Expected production reference on 2026-11-17: 62 public base tables, all RLS enabled,
-- 122 policies on 44 tables; 82 foreign keys; 310 total constraints.
-- Counts are a historical snapshot, not a forever-valid production invariant.

-- 1. Inventory and RLS state (inspect missing tables; do not rely on counts alone).
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;

-- 2. Column shape (exclude table contents).
select table_name, ordinal_position, column_name, udt_name,
       is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- 3. Constraints, including ownership and cascading deletes.
select rel.relname as table_name, con.contype, con.conname,
       pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace n on n.oid = rel.relnamespace
where n.nspname = 'public'
order by rel.relname, con.contype, con.conname;

-- 4. Explicit RLS policy inventory.
select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 5. Sensitive server-only tables: SQL privileges are separate from RLS.
select c.relname as table_name,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select,
       has_table_privilege('service_role', c.oid, 'SELECT') as service_select
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname
  )
order by c.relname;

-- 6. Migration ordering and names; branch-local harness migrations may differ.
select version, name
from supabase_migrations.schema_migrations
order by version;
