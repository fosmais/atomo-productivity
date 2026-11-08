# MVP2 — recuperação de migrações da homologação Supabase

Status: **bloqueado**, sem alteração de produção.

## Evidência (2026-11-08)

- Projeto principal: `qothgddrvrpeqsprslqk`, com 26 migrações registradas.
- Branch paga `myryra-mvp2-finance-homolog`: `xanavauqzsrgvdfhcrsm`, status `MIGRATIONS_FAILED`.
- Primeira migração `20261030174834_autopilot_transactional_reservation` cria uma função que referencia `public.tasks` e `public.events`.
- A segunda, `20261030195840_autopilot_unique_task_reservation_guard`, cria um índice em `public.events`.
- Logs PostgreSQL da branch mostram falha na instrução `CREATE UNIQUE INDEX ... ON public.events (user_id, notes)`. A tabela-base não foi criada na branch.
- A branch contém um harness financeiro isolado criado para testes SQL; **não** representa a estrutura integral do aplicativo.
- O projeto Vercel tem `NEXT_PUBLIC_SUPABASE_URL` global de Preview apontando para o Supabase principal. Não ativar testes financeiros de ponta a ponta nesse Preview.

## Plano seguro de recuperação

1. Localizar a origem/versionamento da criação de `public.tasks` e `public.events`, incluindo RLS, grants, índices e dependências. **Não** copiar dados de usuários.
2. Consolidar uma migração-base idempotente e versionada, anterior às migrações do AutoPilot; validar com banco vazio. Não inventar tabelas parciais somente para fazer o índice passar.
3. Recriar/resetar **somente** a branch de homologação após preservar evidências do harness e confirmar a estratégia de recuperação. Nunca resetar o projeto principal.
4. Executar todas as migrações na ordem, conferir schema, RLS e advisors. Testar acesso entre dois usuários.
5. Configurar variáveis Supabase específicas da branch `test/mvp2-finance-wallet-regression` na Vercel, usando URL e chave publicável da branch isolada. Não alterar as variáveis globais nem expor chaves secretas.
6. Manter checkout/entitlements reais desativados. Validar E2E Finance, Auth, Concierge e Mobile antes de qualquer merge/deploy em PROD.
7. Excluir a branch paga após a homologação para interromper a cobrança por hora.

## Critérios de liberação

- Zero falhas de migração em banco limpo.
- `tasks`, `events` e tabelas financeiras disponíveis com RLS de proprietário.
- Preview comprovadamente isolado do projeto principal.
- Testes automatizados e E2E aprovados.
- Nenhuma cobrança real ativada.
