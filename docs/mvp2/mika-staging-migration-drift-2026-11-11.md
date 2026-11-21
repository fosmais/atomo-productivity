# MYRYRA MVP2 — diagnóstico de divergência das migrações

Data: 2026-11-11. Análise **somente leitura**. Nenhuma alteração aplicada ao Supabase.

## Evidências
- Principal `qothgddrvrpeqsprslqk`: **41** migrações registradas, última `20261111005128 journey_achievement_snapshots`.
- Homologação isolada `xanavauqzsrgvdfhcrsm`: **15** migrações registradas, última `20261108193451 mika_task_execution_audit_schema_fix_staging`.
- Status de branch Supabase: `MIGRATIONS_FAILED`, embora o projeto de banco esteja `ACTIVE_HEALTHY`.
- A homologação inclui migrações locais de MIKA (`mika_action_proposals_staging`, `mika_atomic_decisions_staging`, `mika_atomic_task_execution_staging`) que **não constam** no histórico do principal.
- O principal inclui migrações posteriores de Journey, billing e outras áreas que **não constam** no histórico da homologação.

## Interpretação
A divergência no histórico não prova qual migração falhou, nem garante que a estrutura efetiva das tabelas esteja incompleta. Não executar `reset_branch`, `rebase_branch` ou `merge_branch` sem identificar a migração ofensora, preservar os objetos de MIKA e estimar impactos/custos.

## Próximas verificações
1. Obter erro de migração exato no painel/log de branching e comparar com o histórico no repositório.
2. Confirmar que as tabelas/RPCs da MIKA e suas políticas RLS permanecem presentes.
3. Criar duas identidades sintéticas por Auth no ambiente isolado, sem credenciais reais.
4. Executar os scripts `mika-cross-user-staging.cjs` e `mika-concurrency-staging.cjs`, com evidências.
5. Antes de qualquer integração em produção, revisar privilégios de funções SECURITY DEFINER, migrações compatíveis e testes de regressão.

## Condição de liberação
Sem aprovação até migrações reconciliadas, testes autenticados e concorrência comprovados. Não efetuar deploy ou alteração de dados de clientes automaticamente.

## Verificação adicional (2026-11-11)
- Logs recentes de Postgres filtrados por erro/migração: nenhum registro encontrado na janela consultada. **Não significa ausência de erro histórico**.
- Tabelas presentes na homologação: `public.mika_action_proposals`, `public.mika_action_audit`, `public.plans`, `public.tasks`.
- Tabelas `public.journeys`, `public.journey_missions` e `public.finance_entries` não apareceram na consulta de nomes exatos; isso não confirma a inexistência de tabelas com outros nomes.
- Contagem atual: 0 usuários em `auth.users`, 0 propostas em `mika_action_proposals`.
- Implicação: não assumir paridade entre homologação e produção, e não atribuir causa específica a `MIGRATIONS_FAILED` sem log de branching ou erro reproduzido.

## Revisão de privilégios das RPCs (2026-11-11)
Consulta de catálogo PostgreSQL em homologação, sem alterações:

| Função | EXECUTE anon | EXECUTE authenticated | SECURITY DEFINER |
| --- | --- | --- | --- |
| `mika_decide_proposal(uuid,boolean)` | não | sim | sim |
| `mika_execute_approved_task(uuid,uuid)` | não | sim | sim |

A inspeção das definições SQL confirmou `auth.uid()`, seleção de proposta por `user_id`, bloqueio `FOR UPDATE` e validação de plano no fluxo de execução aprovado. A execução repetida de uma proposta já concluída retorna `already_executed` antes de comparar novamente o argumento `p_plan_id`; isto não cria uma segunda tarefa, mas deve ser avaliado como contrato de API antes da liberação. Essas evidências são estáticas, não substituem os testes com dois usuários reais de homologação.

## Atualização — reconciliação pendente (2026-11-11)
- Comparação completa por `version` via Supabase: **40 migrações presentes somente em PROD**, **15 somente na homologação**, e **1 versão compartilhada** (`20261030174834`). São históricos efetivamente divergentes; não presumir que a aplicação de uma única migração resolve a branch.
- A migração isolada `20261111220502_mika_replay_plan_mismatch_guard_staging` foi aplicada na homologação. A função `mika_execute_approved_task` agora rejeita um `p_plan_id` divergente (`22023`) **inclusive no replay de proposta já executada**, antes de retornar o identificador da tarefa. A observação anterior sobre replay sem validação está superada.
- Verificação pós-alteração: `has_function_privilege('anon',...,'EXECUTE') = false`, `authenticated = true`; RLS de leitura de propostas e auditoria continua restrita a `auth.uid() = user_id`.
- Os dois pipelines do commit `47bc0ae` foram aprovados no GitHub Actions; isso **não** comprova o teste funcional autenticado, pois a homologação ainda tem zero contas sintéticas e zero propostas.
- A branch permanece `MIGRATIONS_FAILED` embora o projeto de preview esteja `ACTIVE_HEALTHY`. Não tentar rebase/reset/merge automaticamente. Obter o erro exato de branching e preparar plano de reconciliação sem tocar PROD.

## Inventário de tabelas efetivas (2026-11-11)
Consulta read-only a `information_schema.tables` (`table_schema='public'`, `table_type='BASE TABLE'`): **PROD tem 60 tabelas** e a **homologação tem 19 tabelas**. A homologação inclui `events`, `plans`, `tasks`, `mika_action_proposals`, `mika_action_audit`, tabelas `myryra_finance_*` e `myryra_privacy_*`. A diferença estrutural é material; histórico de migrações não é a única divergência. Não executar migrações de PROD em lote no staging nem tratar staging como espelho completo da aplicação. A causa específica de `MIGRATIONS_FAILED` ainda depende do erro de branching original.

## Diferença de tabelas por nome (2026-11-11)
Comparação read-only do catálogo `information_schema.tables`: **44 tabelas apenas em PROD**, **3 apenas na homologação**, **16 compartilhadas**. Exclusivas de homologação: `mika_action_audit`, `mika_action_proposals`, `myryra_privacy_rights_requests`. Exclusivas de PROD incluem `myryra_journeys`, `myryra_journey_missions`, `myryra_journey_myra_ledger`, `myryra_health_profiles`, `event_concierge`, `google_calendar_connections`, `billing_subscriptions`, `mika_agent_actions`, `myka_conversations` e `myka_messages`. **A ausência das tabelas novas de MIKA em PROD não autoriza sua criação sem homologação.** Comparação por nome não confirma equivalência de colunas, índices, constraints, RLS ou funções nas 16 tabelas compartilhadas. Próximo passo: obter falha original do branching e criar estratégia de migrations aditivas compatíveis, seguida de teste de duas identidades sintéticas.

## Paridade de colunas nas 16 tabelas compartilhadas (2026-11-11)
Comparação read-only de `information_schema.columns` (nome, tipo UDT, nulabilidade e default): **13 tabelas sem diferenças detectadas**; **3 com diferenças**:
1. `myryra_finance_entries`: `deleted_at` somente no staging.
2. `myryra_finance_subscriptions`: `deleted_at` somente no staging.
3. `myryra_privacy_document_versions`: `created_at` somente em PROD; `status` default `'draft'::text` em PROD, sem default no staging.
**Não aplicar automaticamente** as colunas de staging em PROD: `deleted_at` pode ser parte de um contrato de soft-delete ainda não homologado. Esta comparação não valida constraints, triggers, índices, RLS, grants, nem semântica de dados.

## Comparação preliminar RLS (2026-11-11)
Consulta read-only a `pg_class`/`pg_policy`: as **16 tabelas compartilhadas** possuem `relrowsecurity=true` em ambos os ambientes. Contagens de políticas diferentes: `events` PROD 5/staging 4; `myryra_finance_entries` PROD 3/staging 4; `myryra_finance_subscriptions` PROD 3/staging 4. As demais 13 possuem a mesma quantidade de políticas, **sem comprovação de equivalência de expressões, roles, comandos ou grants**. Não copiar políticas automaticamente nem desabilitar RLS.

## Inspeção de expressões RLS e grants (2026-11-11)
Comparação read-only `pg_policies`: **20 políticas** em 7 tabelas Finance (`myryra_finance_alert_preferences`, `balances`, `delivery_log`, `expected_income`, `goals`, `notifications`, `planned_expenses`) têm equivalência exata de `cmd`, `roles`, `qual`, `with_check` entre PROD e staging. Quatro tabelas LGPD compartilhadas (`myryra_privacy_acceptances`, `choices`, `document_versions`, `purposes`) também apresentam as mesmas expressões. `plans` e `tasks` preservam verificação de proprietário e, para tarefas, a propriedade do plano associado, embora os nomes de políticas sejam diferentes. Nas tabelas Finance `entries` e `subscriptions`, staging tem política `UPDATE` owner-only e PROD não tem. O papel `authenticated` tem privilégio SQL de UPDATE em ambas as tabelas de PROD, porém o RLS impede updates diretos sem política correspondente. O script de correção **apenas proposto** está em `docs/mvp2/sql/finance-owner-update-policies-prod-proposal.sql`; executar somente após testes autenticados e revisão de mudanças. O catálogo de grants PROD também lista privilégios `TRUNCATE`, `TRIGGER` e `REFERENCES` para `authenticated` nessas duas tabelas; revisar exposição antes de publicar, sem alterar grants precipitadamente.
