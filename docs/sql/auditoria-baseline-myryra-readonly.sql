-- MYRYRA: auditoria SOMENTE LEITURA da capacidade de reconstrução do schema.
-- Executar no SQL Editor do projeto de referência. NÃO altera tabelas, políticas ou migrações.
-- Não contém dados pessoais; retorna apenas metadados de catálogo.
-- Data: 2026-11-12

-- 1. Histórico: primeiro passo depende de objetos que não são criados por ele.
select count(*) as migrations, min(version) as first_version, max(version) as last_version
from supabase_migrations.schema_migrations;

-- 2. Tabelas e estado RLS (todas as tabelas public devem ter RLS).
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
order by c.relname;

-- 3. Colunas para futura exportação de schema-only.
select table_name, ordinal_position, column_name, data_type, udt_name,
       is_nullable, column_default, identity_generation, is_generated
from information_schema.columns
where table_schema='public'
order by table_name, ordinal_position;

-- 4. Chaves e restrições.
select conrelid::regclass::text as table_name, conname,
       pg_get_constraintdef(oid) as definition
from pg_constraint
where connamespace='public'::regnamespace
order by table_name, conname;

-- 5. Índices, incluindo expressões e índices parciais.
select tablename, indexname, indexdef
from pg_indexes where schemaname='public'
order by tablename, indexname;

-- 6. Políticas RLS.
select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname='public'
order by tablename, policyname;

-- 7. Dependências iniciais da Agenda/Journey/AutoPilot.
select c.conrelid::regclass::text as dependent_table,
       c.confrelid::regclass::text as referenced_table,
       pg_get_constraintdef(c.oid) as constraint_sql
from pg_constraint c
where c.contype='f' and c.conrelid in
('public.events'::regclass,'public.tasks'::regclass,
 'public.plans'::regclass,'public.myryra_journeys'::regclass)
order by dependent_table, referenced_table;

-- IMPORTANTE: este inventário NÃO é dump restaurável.
-- Para baseline executável, usar dump schema-only compatível com Supabase,
-- revisar extensões, grants, funções, triggers, schemas auth/storage,
-- e validar em banco isolado antes de versionar o baseline.
