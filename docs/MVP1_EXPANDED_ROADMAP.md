# MYRYRA — MVP 1 ampliado (aprovado em 2026-10-30)

## Escopo aprovado: cinco funcionalidades

| Funcionalidade | Base encontrada | Entrega do MVP 1 | Estado |
|---|---|---|---|
| What Now? | `what-now.tsx` recomenda por prioridade e vencimento a partir de Cloud Plans | Incorporar tempo livre e compromissos; sugerir próxima ação explicável | Parcial |
| Daily Briefing | `daily-copilot.tsx` e `daily-planner` | Resumo automático de compromissos, prioridades, conflitos e tempo disponível | Parcial |
| Captura Rápida / Brain Dump | MYKA já propõe tarefas via Concierge | Campo de texto para múltiplas tarefas, revisão e confirmação explícita antes de salvar | Pendente |
| Focus Mode | Novo `focus-mode.tsx` integrado ao Planner | Timer 15/25/45/60 min, pausa e reinício | Implementado no código; QA pendente |
| Weekly Intelligence Lite | `performance-insights.tsx` e `vyra-period-metrics` | Resumo semanal simples, concluídas, atrasadas e evolução | Parcial |

## Ordem de execução
1. Focus Mode: validar build, mobile e timer; considerar persistência posterior.
2. Captura Rápida: aproveitar proposta de tarefas existente e exigir confirmação individual.
3. Daily Briefing: reunir agenda, tarefas e janelas livres, evitando chamadas desnecessárias de IA.
4. What Now?: recomendar uma única ação viável com base no tempo disponível.
5. Weekly Intelligence Lite: aproveitar métricas existentes e evitar duplicar cálculos.

## Critérios de aceite
- Sem alteração dos planos gratuitos da infraestrutura.
- Sem criar tarefas ou eventos sem consentimento explícito.
- Todas as consultas e gravações respeitam a sessão e RLS do usuário.
- Layout funcional em celular e desktop.
- Testar fluxos autenticados e persistência antes de declarar concluído.
- Não bloquear o lançamento por integrações de Google Maps, voz ou Business.
