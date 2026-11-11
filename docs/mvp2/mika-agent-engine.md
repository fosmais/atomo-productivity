# MIKA Agente — MVP2: Execução Assistida

## Objetivo
Converter solicitações do chat em planos verificáveis e ações executadas somente após autorização explícita. Preservar Agenda, Tarefas, Concierge e Finance existentes.

## Fluxo
1. Interpretar a intenção, sem executar efeitos colaterais.
2. Consultar dados do usuário autenticado e permissões válidas.
3. Gerar proposta estruturada com ações, parâmetros, impactos e dependências.
4. Validar plano no servidor (schema, autorização por recurso, horários, conflitos, limites).
5. Persistir plano em estado `pending_approval` e exibir resumo legível.
6. Após aprovação explícita, conferir usuário, versão do plano, expiração e escopo autorizado.
7. Executar por ferramentas de backend com chave de idempotência e auditoria por etapa.
8. Informar sucessos, falhas parciais e alternativas; jamais declarar sucesso antes de confirmação.

## Estados
`draft -> pending_approval -> approved -> executing -> completed | partially_completed | failed`.
Alternativas: `rejected`, `expired`, `cancelled`. Toda transição deve ser validada no backend.

## Primeiras ferramentas
- `list_calendar_events` (leitura)
- `list_tasks` (leitura)
- `propose_daily_plan` (somente proposta)
- `create_task` (escrita autorizada)
- `update_task` (escrita autorizada)
- `create_calendar_event` (escrita autorizada)

## Segurança e LGPD
- Aceite vigente obrigatório para usuários novos e existentes antes de habilitar a execução.
- RLS e isolamento por usuário; jamais aceitar `user_id` fornecido pelo modelo.
- Autorizações vinculadas ao usuário, plano imutável, versão, ações específicas e prazo de expiração.
- Aprovação por ação sensível; nenhuma movimentação financeira ou exclusão definitiva neste bloco.
- Logs com minimização de dados pessoais, sem tokens, segredos ou conteúdo sensível desnecessário.
- Limites de taxa, retries controlados e idempotência; proibir reexecução por clique duplo.
- Autonomia assistida por padrão; AutoPilot permanece desabilitado.

## Critérios de aceite
- Proposta não altera dados antes da aprovação.
- Rejeição, expiração e revogação impedem execução.
- Não há execução entre usuários ou organizações.
- Dupla aprovação não duplica tarefas/eventos.
- Falha parcial produz estado e relatório fiéis.
- Testes de integração e homologação web/mobile aprovados antes de produção.

## Reutilização obrigatória do fluxo existente
- A migração `database/migrations/20261028_myka_proposal_status.sql` já define `public.myka_confirm_task(uuid)`, com bloqueio transacional `FOR UPDATE`, verificação de `auth.uid()` e retorno `already_saved` para impedir duplicação de tarefas.
- Antes de criar outro executor de tarefas, verificar no Supabase ativo se a função foi aplicada e se a rota existente a utiliza. Não duplicar o fluxo de confirmação nem presumir que a migração está em produção.
- O motor novo deve usar `actionId` persistente, digest do payload e aprovação por usuário; a checagem pura em `execution-gate.ts` não substitui a transação que reivindica a ação.
- A confirmação de tarefa já existente é diferente de autorização genérica para abrir aplicativos. Integrações externas exigem APIs/OAuth específicos, escopos e consentimento individual; abrir um link não constitui execução integrada.
- Antes de conectar um executor novo, validar idempotência em concorrência, rejeição, expiração, revogação e isolamento entre usuários em ambiente de homologação.

## Próximo trabalho
Inspecionar rotas, serviços, schemas e políticas RLS atuais; reutilizar os componentes existentes. Implementar migrações, endpoints de proposta/aprovação/execução, UI de aprovação e testes em commits pequenos. Não realizar deploy automático nem habilitar pagamentos reais.
