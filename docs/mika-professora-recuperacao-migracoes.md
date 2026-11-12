# MYRYRA — Recuperação das migrações e homologação MIKA Professora

Data do diagnóstico: 2026-11-12. Documento de diagnóstico; **não** é um baseline SQL executável.

## Evidência confirmada

- Projeto principal Supabase: `qothgddrvrpeqsprslqk`.
- Branch temporária `myryra-mika-professora-homolog` excluída após falha de reconstrução; não recriar sem nova avaliação de custos.
- A primeira migração registrada, `20261030174834_autopilot_transactional_reservation`, tenta criar o índice `events_autopilot_task_once_per_user_idx` sobre `public.events`. Log do Postgres na branch: `relation "public.events" does not exist`.
- Produção possui 60 tabelas comuns no schema `public`, todas com RLS habilitado, 78 chaves estrangeiras, 115 políticas e 134 índices (contagens do catálogo em 2026-11-12).
- Dependências diretas: `plans → auth.users`, `tasks → plans, auth.users`, `events → auth.users`, `myryra_journeys → auth.users`.
- `mika_teacher_sessions` e `mika_teacher_messages` **não existem em produção**.

## Bloqueio arquitetural

O histórico de migrações começa com alterações incrementais em tabelas preexistentes, não com a criação das tabelas de base. Portanto, rebase/reset em branch vazia falha. **Não** contornar com tabelas mínimas artificiais, marcar migrações como executadas ou alterar o histórico de produção.

## Plano de recuperação

1. Extrair um **schema-only** consistente do banco principal, sem linhas de dados, incluindo tabelas, sequências, constraints, funções, triggers, índices, grants e políticas RLS. Inspecionar dependências de `auth`, `storage` e extensões.
2. Versionar o baseline em artefato separado e revisado. Estabelecer estratégia para migrações incrementais já presentes: evitar executar novamente objetos que o baseline já contém; definir ponto de corte de histórico e verificar checksum/ordem.
3. Testar do zero em PostgreSQL/Supabase **isolado**, preferencialmente local, sem custo de branch horária; executar smoke tests de esquema, permissões e RLS.
4. Somente depois criar ambiente de homologação, mediante avaliação de custos, e aplicar `docs/sql/mika-teacher-sessions.sql` com testes de acesso entre dois usuários, autenticação/MFA, criação/retomada/exclusão de sessão e persistência das mensagens.
5. Homologar fluxo de aulas, agendamento/reagendamento e correção de atividades antes de liberar produção. A interface atual não equivale a agendamento completo.

## Consultas somente leitura para diagnóstico

```sql
select version, name from supabase_migrations.schema_migrations order by version;
select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r';
select schemaname, tablename, policyname, cmd from pg_policies
 where schemaname='public' order by tablename, policyname;
select conrelid::regclass, confrelid::regclass, pg_get_constraintdef(oid)
 from pg_constraint where contype='f' and connamespace='public'::regnamespace;
```

## Guardrails

- Nunca copiar dados reais para testes sem autorização específica.
- Não alterar produção nem ativar pagamentos reais.
- Não registrar como homologado sem testes E2E e RLS.
- Evitar commits e builds repetitivos na Vercel; priorizar verificações locais e um deploy controlado após validação.
