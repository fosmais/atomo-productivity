# MYRYRA MVP2 — checklist oficial de encerramento

Data da consolidação: 21/11/2026

Este documento controla os sete gates finais acordados. Percentual histórico de referência: **90%**. O percentual não é recalculado por testes isolados; somente muda quando houver evidência de aceite ou regressão.

## 1. MIKA Professora + Journey — E2E real

**Status: PARCIAL / BLOQUEADO POR E2E AUTENTICADO**

- Implementado: vínculo de sessão da Professora com missão/jornada/proprietário; exercícios oficiais versionados; avaliação persistida; guard de conclusão; crédito MYRA idempotente.
- Evidência: CI dos branches de homologação; testes SQL sintéticos com rollback para nota mínima, exercício vigente e crédito único.
- Pendente: HTTP E2E com sessão real (login → jornada → aula → exercício oficial → resposta → avaliação MIKA → conclusão → saldo MYRA), incluindo aceite legal/MFA.
- Não marcar concluído com base em teste estático ou SQL sintético.

## 2. Isolamento entre usuários e concorrência

**Status: PARCIAL / TESTES REAIS AINDA NÃO EXECUTADOS**

- Implementado: harness de duas sessões Auth para Journey e harness MIKA de 20 chamadas concorrentes.
- Evidência: CI do PR #63 com rehearsal PostgreSQL sintético aprovado; catálogo staging confirma ausência de UPDATE direto de missões, DELETE direto de jornadas e escrita direta no ledger para authenticated.
- Pendente: workflow de duas contas Supabase Auth reais; 20 execuções HTTP concorrentes com fixture sintética aprovada; confirmar uma única tarefa/crédito e nenhum acesso cruzado.

## 3. MIKA Agente

**Status: CÓDIGO / CI / PREVIEW APROVADOS; E2E PENDENTE**

- Commit 0a478287620c5c1c1c41e5b1c39d63509cca06a4 restringe a execução de tarefas aprovadas ao Preview da branch feat/myryra-mvp2-mika-agent-engine e ao Supabase staging exato.
- Vercel Preview READY: https://atomo-productivity-5y3yb5x1q-fosmais.vercel.app.
- npm test: 217 aprovados, 0 falhas; build Next.js concluído.
- Pendente: configurar credenciais branch-scoped de staging, executar E2E de proposta/aprovação/execução/replay, verificar auditoria persistida e concorrência. Execução continua desativada enquanto variáveis não estiverem configuradas.

## 4. Finance integrado

**Status: CÓDIGO / PREVIEW APROVADOS; E2E COM DUAS CONTAS PENDENTE**

- Implementado: edição owner-scoped, valores em centavos, confirmação de persistência, lixeira/soft delete e filtros de saldo/resumo.
- Criados scripts/finance-two-users-staging.cjs e workflow manual .github/workflows/finance-two-users-staging.yml para duas contas sintéticas; cobre isolamento de leitura/escrita, edição, soft delete e restauração de lançamentos/assinaturas.
- Vercel Preview READY: https://atomo-productivity-cbyqf0rei-fosmais.vercel.app.
- Pendente: executar workflow com secrets do environment GitHub staging; validar reconciliação de saldo, metas, importação e assinaturas com duas sessões reais.

## 5. Regressão Android

**Status: PARCIAL**

- Cinco testes básicos de homologação Android foram reportados como aprovados anteriormente.
- Pendente: regressão integrada atual das jornadas Journey/Professora, Agenda, Tarefas, Finance e MIKA Agente em dispositivo Android; validar navegação, estados de erro, persistência, acessibilidade e notificações.
- Preview web ou CI Node não substituem teste em dispositivo.

## 6. Segurança e LGPD

**Status: BLOQUEADOR P0 — DIVERGÊNCIA PROD/STAGING**

Consulta read-only de catálogo em 21/11/2026:

| Controle | Staging xanavauqzsrgvdfhcrsm | PROD qothgddrvrpeqsprslqk |
|---|---|---|
| myryra_journey_assigned_exercises | Existe | Ausente |
| Trigger de conclusão avaliada | Existe | Ausente |
| authenticated UPDATE em missões | Não | Sim |
| authenticated DELETE físico de jornadas | Não | Sim |
| authenticated INSERT/UPDATE no ledger | Não | Não |

- O branch Supabase de homologação consta MIGRATIONS_FAILED, embora as tabelas/triggers principais estejam presentes. Investigar sem resetar ou sobrescrever dados.
- Produção mantém grants diretos de alteração de missões e exclusão física de jornadas; as FKs em cascata podem afetar histórico MYRA. Tratar como risco de integridade/bypass a ser validado, não como exploração confirmada.
- Pendente: reconciliação de schema/migrations, revisão de grants/RLS/triggers, ensaio em clone descartável, revisão LGPD/consentimento e rollback.
- Nenhuma migração ou alteração foi aplicada em PROD.

## 7. Homologação geral e liberação controlada

**Status: BLOQUEADO PELOS GATES ACIMA**

- PRs de integração permanecem Draft; não fazer merge ou promoção.
- Não habilitar cobranças reais Asaas.
- Não alterar produção nem executar migrações de produção sem autorização específica.
- Critério de conclusão: itens 1–6 aprovados com evidências reproduzíveis; CI/build verde; duas contas Auth reais; regressão Android; revisão de segurança/LGPD; plano de rollback e verificação pós-release.

## Limites de execução

Desenvolvimento, testes automatizados, documentação e homologação em staging estão autorizados. Alterações de schema/dados em produção, merge de release, promoção para PROD e ativação de cobranças reais permanecem fora do escopo deste checklist sem autorização específica.
