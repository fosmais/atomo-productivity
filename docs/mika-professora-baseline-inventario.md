# MIKA Professora — baseline mínimo de homologação (inventário)

Fonte: catálogos PostgreSQL do Supabase principal, consultados em 2026-11-13 (somente leitura). **Este documento não é uma migração executável e não deve ser aplicado em produção.**

## Ordem de dependência

1. `auth.users` (gerenciado pelo Supabase)
2. `public.myryra_journeys` (10 colunas)
3. `public.mika_teacher_sessions` (9 colunas)
4. `public.mika_teacher_messages` (6 colunas)

## Restrições verificadas

- Journeys: PK `id`, FK `owner_id -> auth.users(id)` com CASCADE; `status` em `active,paused,completed,archived`; `visibility` em `private,shared`; `title` não vazio e até 120 caracteres.
- Sessions: PK `id`, UNIQUE `(id,owner_id)`; FKs `owner_id -> auth.users(id)` e `journey_id -> myryra_journeys(id)`, ambas CASCADE; `topic` 1–120; `level` 1–40; `status` em `active,completed,cancelled`.
- Messages: PK `id`, FK `owner_id -> auth.users(id)` e FK composta `(session_id,owner_id) -> mika_teacher_sessions(id,owner_id)`, ambas CASCADE; `role` em `user,assistant`; `content` 1–4000.

## Segurança verificada

- As três tabelas possuem políticas RLS por proprietário.
- Messages: apenas SELECT do proprietário; gravações feitas no servidor.
- Sessions: SELECT/DELETE do proprietário; UPDATE apenas para sessões ativas e sem troca de proprietário; INSERT exige Journey ativa pertencente ao usuário no esquema atual.
- A migração proposta no PR #20 torna `journey_id` opcional e substitui somente a política de INSERT, mantendo as demais proteções.

## Critérios para liberar homologação

- [ ] Recuperar o DDL integral (tipos, defaults, índices, triggers, grants e RLS) e o histórico divergente de migrações.
- [ ] Construir baseline executável **somente** em ambiente descartável e sem dados de produção.
- [ ] Verificar políticas para dois usuários autenticados diferentes (isolamento).
- [ ] Verificar criação de sessão livre com `journey_id=NULL`, mensagens, histórico e reagendamento.
- [ ] Confirmar que sessões vinculadas a Journey continuam funcionando.
- [ ] Executar E2E autenticado e revisar custo antes de qualquer nova branch paga.

Não marcar como homologado nem fazer deploy em PROD até concluir esses itens.
