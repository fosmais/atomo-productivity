# MYRYRA — inventário de dependências da migração-base

Fonte: consultas somente leitura ao catálogo PostgreSQL do projeto principal, em 2026-11-08. **Não contém dados de usuários nem credenciais.**

## Ordem de dependência

1. `auth.users` (fornecida pelo Supabase Auth)
2. `public.plans` (PK `id`, FK `user_id -> auth.users(id) ON DELETE CASCADE`)
3. `public.tasks` (PK `id`, FK `plan_id -> plans(id) ON DELETE CASCADE`, FK `user_id -> auth.users(id) ON DELETE CASCADE`)
4. `public.events` (PK `id`, FK `user_id -> auth.users(id) ON DELETE CASCADE`)
5. Migração AutoPilot `20261030174834` (função usa tasks/events)
6. Migração `20261030195840` (índice em events)

## Colunas principais

- plans: `id uuid PK default gen_random_uuid()`, `user_id uuid NOT NULL`, `title text NOT NULL`, `source_text text NULL`, `created_at timestamptz NOT NULL default now()`.
- tasks: `id uuid PK default gen_random_uuid()`, `plan_id uuid NOT NULL`, `user_id uuid NOT NULL`, `title text NOT NULL`, `priority text NOT NULL default 'Normal'`, `due_date date NULL`, `completed boolean NOT NULL default false`, `created_at timestamptz NOT NULL default now()`, `status text NOT NULL default 'todo'`, `duration_minutes integer NULL`, `completed_at timestamptz NULL`, `deleted_at timestamptz NULL`, `category text NOT NULL default 'personal'`.
- events: `id uuid PK default gen_random_uuid()`, `user_id uuid NOT NULL`, `title text NOT NULL`, `starts_at timestamptz NOT NULL`, `ends_at timestamptz NOT NULL`, `location text NULL`, `notes text NULL`, `created_at timestamptz NOT NULL default now()`, `event_type text NOT NULL default 'appointment'`, `blocks_time boolean NOT NULL default false`, `deleted_at timestamptz NULL`, `category text NOT NULL default 'personal'`.

## Restrições adicionais verificadas

- events: título com 1–200 caracteres; `ends_at > starts_at`; categoria em `work,family,leisure,health,personal,study`.
- tasks: duração nula ou 5–1440 minutos; status em `todo,in_progress,waiting,done`; mesma lista de categorias.
- RLS habilitado nas três tabelas. Em `tasks`, políticas SELECT/INSERT/UPDATE/DELETE verificam proprietário da tarefa **e** propriedade do plano associado; `plans` e `events` restringem ao `auth.uid() = user_id`. UPDATE exige USING e WITH CHECK.
- Há política adicional de UPDATE de categoria em events; não substituir políticas sem revisar semântica existente.

## Pendências antes da execução

- Recuperar definições completas dos índices, privilégios e políticas e identificar a migração-base original no repositório/histórico.
- Gerar SQL versionado **anterior** a 20261030174834; revisar com cuidado o estado inicial versus colunas adicionadas em migrações posteriores.
- Executar em ambiente isolado limpo, conferir todas as 26 migrações e testes RLS; não aplicar em produção.
