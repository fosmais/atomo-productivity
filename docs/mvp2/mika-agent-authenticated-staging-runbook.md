# MIKA MVP2 — pré-requisitos de homologação autenticada

Status: **bloqueado até preparação de fixtures sintéticas**. Não executar no banco principal.

## Ambiente autorizado
- Branch Supabase: `myryra-mvp2-finance-homolog` (`xanavauqzsrgvdfhcrsm`).
- Confirmar que a branch está isolada e que o histórico de migrações foi reconciliado (atualmente `MIGRATIONS_FAILED`).
- Nunca utilizar credenciais de produção, service-role, dados reais de clientes ou contas pessoais.

## Preparação controlada
1. Criar uma conta sintética A via fluxo normal de Auth no ambiente isolado; criar conta B separada para testes cross-user.
2. Autenticar A, confirmar que o JWT tem role `authenticated`, sub igual ao usuário A e validade vigente.
3. Criar plano com título prefixado `[MIKA-STAGING-TEST]` pertencente a A.
4. Criar proposta `create_task` pertencente a A, com título prefixado `[MIKA-STAGING-TEST]`, payload.plan_id do plano, vencimento futuro e estado `pending`.
5. Aprovar a proposta pela RPC autenticada `mika_decide_proposal` usando a sessão de A. Não atualizar o estado diretamente por SQL privilegiado.
6. Verificar `approved` e auditoria `approved` antes de iniciar concorrência.

## Execução
Definir em ambiente local seguro: `MIKA_STAGING_URL`, `MIKA_STAGING_ANON_KEY`, `MIKA_TEST_ACCESS_TOKEN`, `MIKA_TEST_PROPOSAL_ID`, `MIKA_TEST_PLAN_ID`.

Executar `node scripts/mika-concurrency-staging.cjs`.

Critérios: 20 chamadas simultâneas; exatamente uma resposta `executed`; 19 `already_executed`; mesmo task_id; um registro de tarefa e um evento de auditoria `succeeded`.

## Segurança complementar
- Conta B não pode ler, aprovar ou executar proposta de A.
- Sem token, com token expirado e com proposta expirada: nenhuma mutação permitida.
- Repetição da chamada deve devolver o mesmo resultado, sem nova tarefa.
- Confirmar logs sem tokens ou payloads pessoais.
- Os alertas de `SECURITY DEFINER` devem ser revisados e documentados antes de PROD.

## Encerramento
Registrar resultado e evidências sem segredos; remover apenas fixtures sintéticas identificadas e autorizadas. Nenhum merge/deploy automático.
