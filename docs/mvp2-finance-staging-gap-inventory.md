# MYRYRA MVP2 — inventário Finance para homologação isolada

Consulta somente leitura ao catálogo do projeto principal; nenhuma alteração em produção.

## Tabelas Finance presentes no projeto principal (9)
- myryra_finance_alert_preferences
- myryra_finance_balances
- myryra_finance_delivery_log
- myryra_finance_entries
- myryra_finance_expected_income
- myryra_finance_goals
- myryra_finance_notifications
- myryra_finance_planned_expenses
- myryra_finance_subscriptions

## Tabelas presentes na branch isolada (2)
- myryra_finance_entries
- myryra_finance_subscriptions

## Tabelas faltantes na branch (7)
- myryra_finance_alert_preferences
- myryra_finance_balances
- myryra_finance_delivery_log
- myryra_finance_expected_income
- myryra_finance_goals
- myryra_finance_notifications
- myryra_finance_planned_expenses

## Prioridade
1. Reconstruir balances, goals e planned_expenses preservando constraints, índices, políticas RLS e sem reexecutar migrações originais incompatíveis sobre o harness.
2. Depois expected_income, alert_preferences, notifications e delivery_log.
3. Validar fluxo autenticado e duas identidades, incluindo exclusão/restauração.
4. Não habilitar Finance Trash em produção antes de migração versionada e E2E.

## Estado de entrega
- GitHub Actions: regression checks e MVP1 Quality and Security aprovados no commit a8ccd79d.
- Vercel Preview isolado: deployment dpl_9oKPFfrVp49rH4x27m9HEhXJ4FT8 READY.
- UI/E2E autenticado: pendente.
- Pagamentos reais: desabilitados.
