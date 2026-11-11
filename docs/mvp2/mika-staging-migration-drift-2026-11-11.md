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
