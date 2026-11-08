# MYRYRA Finance — análise de índices em staging (2026-11-08)

## Evidência observada
Supabase staging `xanavauqzsrgvdfhcrsm`, somente leitura nesta análise.

- `finance_entries_active_owner_idx`: `(user_id, created_at DESC) WHERE deleted_at IS NULL`; `idx_scan=2`.
- `myryra_finance_entries_user_active_idx`: definição idêntica; `idx_scan=0`.
- `myryra_finance_entries_user_created_idx`: `(user_id, created_at DESC)` sem predicado; **não é equivalente** aos anteriores.
- `myryra_finance_entries_pkey`: índice único em `id`; preservar.
- Advisor de segurança: nenhum achado.
- Advisor de performance: um par de índices duplicados; FK `myryra_finance_delivery_log_user_id_fkey` sem índice de cobertura. Outros achados em `plans` e `tasks` são fora do Finance.

## Plano proposto (NÃO EXECUTADO)
1. Revisar migrations versionadas e o replay CI antes de alterar a contagem de índices.
2. Em staging isolado, avaliar remoção de **apenas** `myryra_finance_entries_user_active_idx` (duplicado não utilizado); manter `finance_entries_active_owner_idx`, índice sem predicado e PK.
3. Avaliar índice de `myryra_finance_delivery_log(user_id)` segundo plano de consultas e volume. Não criar cegamente.
4. Atualizar asserts do clean replay, rodar testes de RLS e advisor novamente.
5. Não promover SQL para PROD sem autorização específica e E2E autenticado aprovado.

Referências: https://supabase.com/docs/guides/database/database-linter?lint=0009_duplicate_index e https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys

**Estado:** diagnóstico somente leitura; nenhuma migração, remoção ou alteração de dados realizada.
