# MYRYRA MVP2 — Controle de conclusão verificável

Atualizado em 2026-11-11. Este documento substitui o uso de "85%" como medida comprovada.

## Regra de medição
Cada frente deve ter critérios objetivos, evidência (commit, CI, homologação, deploy) e quatro estados independentes:
- Implementado no código: PR/commit identificado.
- Testado automaticamente: CI do commit correspondente aprovado.
- Homologado: roteiro ponta a ponta executado com evidência, incluindo mobile quando aplicável.
- Produção: deploy identificado e comportamento conferido no ambiente real.

**Uma alteração em branch de desenvolvimento não equivale a entrega em produção.**
**Não calcular porcentagem consolidada enquanto o inventário e os pesos não forem aprovados.**

## Inventário inicial e pendências

| Frente | Evidência de código | Pendência para encerramento |
| --- | --- | --- |
| Journey: jornadas, missões, replanejamento e MYRA | Rotas em src/app/api/journeys; UI em src/app/journey; testes Journey | Homologar criação, edição, exclusão, retomada, moedas, histórico, compartilhamento e mobile; verificar deploy |
| MIKA Agente | src/app/api/mika/actions/route.ts; docs/mvp2/mika-agent-engine.md | A rota de proposta não executa provedor externo. Confirmar executor transacional, aprovação/revogação, OAuth por provedor, idempotência, auditoria e homologação |
| Concierge | Fluxos de propostas e handoff existentes | Provar integração real por provedor; abrir URL não é integração. Testar permissões e falhas |
| Agenda e tarefas | Módulos no dashboard e integrações existentes | Testar Google Calendar, persistência, links navegáveis, conclusão, mobile e regressão |
| Finance | Módulos Finance existentes | Validar saldos, lançamentos, exclusão, metas, assinaturas, RLS e mobile; não habilitar cobrança real |
| LGPD | GET /api/privacy/readiness; POST /api/privacy/accept; tela /privacy/accept; gate condicional dashboard e algumas APIs | Publicar documentos oficiais; teste real com usuários antigos/novos; proteger demais APIs mutáveis; ativar flag somente após homologação |
| Billing Asaas | Sandbox e controles de readiness | Homologar fluxo e entitlements; cobranças reais seguem desabilitadas |
| Estabilidade, segurança e release | Workflows GitHub e testes automatizados | Confirmar CI no SHA final, revisão de permissões, teste ponta a ponta e deploy com rollback |

## Checklist para a próxima medição
1. Listar todas as funcionalidades aprovadas no escopo MVP2, com peso explícito e responsável.
2. Para cada item, marcar implementado, CI, homologado e produção separadamente, anexando evidência.
3. Só marcar "concluído" após critérios de aceite e produção aplicáveis; itens deliberadamente desativados permanecem pendentes ou são formalmente retirados do escopo.
4. Calcular percentual como soma dos pesos de itens concluídos / soma dos pesos totais; exibir também percentual implementado para evitar confusão.
5. Reavaliar a cada merge/deploy/homologação, nunca por número de commits ou linhas alteradas.

## Restrições de rollout
- Não alterar produção automaticamente.
- Não habilitar pagamentos reais nem ações externas autônomas.
- Não ativar MYRYRA_LEGAL_ACCEPTANCE_GATE_ENABLED enquanto faltarem documentos publicados e homologação do fluxo.
- Evitar builds/deploys desnecessários por custo.
