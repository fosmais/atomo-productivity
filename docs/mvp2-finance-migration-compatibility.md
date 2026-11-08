# MYRYRA MVP2 — compatibilidade das migrações Finance

Data: 2026-11-08. Análise somente leitura das migrações registradas no projeto principal e das tabelas presentes na branch isolada.

## Divergência importante

A branch `myryra-mvp2-finance-homolog` contém um **harness isolado** de testes que já criou:
- `public.myryra_finance_entries`
- `public.myryra_finance_subscriptions`

No projeto principal, essas tabelas são criadas pelas migrações originais:
- `20261103144028_myryra_finance_entries_rls`
- `20261103151443_myryra_finance_recurring_subscriptions`

Ambas usam `CREATE TABLE IF NOT EXISTS` **mas** criam políticas `CREATE POLICY` sem proteção contra duplicidade. Portanto, reaplicar essas migrações diretamente sobre o harness pode falhar em políticas existentes ou deixar estruturas divergentes. Não marcar migrações como concluídas sem realmente executá-las.

## Sequência inicial Finance registrada em produção

1. `20261103144028` — entries, índice, RLS, SELECT/INSERT/DELETE
2. `20261103144430` — opening balance, RLS, SELECT/INSERT/UPDATE
3. `20261103144732` — goals e planned expenses, índices e RLS
4. `20261103151443` — subscriptions, índice e RLS
5. Migrações posteriores: expected income, alert preferences, notifications, delivery log, priorities e políticas de UPDATE

## Próxima execução segura

1. Exportar e revisar os arquivos versionados completos; reconstruir em **branch limpa** com bootstrap anterior à primeira migração, preservando o histórico.
2. **Não** rodar a cadeia original diretamente sobre o harness Finance já existente.
3. Executar SQL de teste e validar RLS por duas identidades em transações com ROLLBACK.
4. Verificar contagem e ordem das migrações e configurar Preview isolado.
5. Apagar a branch paga quando não for mais necessária, pois a cobrança é contínua.

Nenhuma migração Finance original foi aplicada nesta análise; produção inalterada.
