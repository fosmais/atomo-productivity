# Gate P0 — histórico MYRA e exclusão de jornadas (PR #62)

**Status: revisão, sem autorização de aplicação.** Este documento não altera o banco.

## Invariantes
1. HTTP DELETE de jornada apenas arquiva a jornada do proprietário; nunca apaga a linha.
2. Créditos MYRA concedidos devem continuar no ledger após arquivamento e não podem ser duplicados por repetição de conclusão.
3. Cliente autenticado não deve possuir DELETE físico em public.myryra_journeys após rollout aprovado.
4. O ledger de PROD ainda depende de FKs ON DELETE CASCADE; **não executar exclusão física nem liberar o rollback de DELETE** antes da migração de preservação de histórico e seus testes.

## Ordem obrigatória para liberação
- Inventariar clientes web/mobile e chamadas diretas à tabela, grants e RLS em staging e PROD.
- Validar migração de ledger em clone descartável, com FK CASCADE -> SET NULL e chave imutável source_mission_id UNIQUE, verificando idempotência, saldos e dados legados.
- Validar dois usuários Auth reais: edição, pausa, retomada, arquivamento, tentativa de DELETE direto e isolamento entre contas.
- Conferir backups, plano de rollback seguro, monitoramento e janela de mudança.
- Obter autorização explícita antes de qualquer DDL, merge ou deploy PROD.

## Consultas de diagnóstico somente leitura
```sql
SELECT has_table_privilege('authenticated','public.myryra_journeys','DELETE') AS authenticated_can_delete;
SELECT has_table_privilege('authenticated','public.myryra_journeys','UPDATE') AS authenticated_can_update;
SELECT has_table_privilege('service_role','public.myryra_journeys','UPDATE') AS service_role_can_update;
SELECT policyname, cmd, roles, qual FROM pg_policies
 WHERE schemaname='public' AND tablename='myryra_journeys';
```

## Não confundir evidências
- Testes estáticos em Node verificam contratos no código, **não** provam integridade real do ledger.
- Ensaios sintéticos com tabelas temporárias não substituem migração em clone e E2E com RLS.
- A proposta de REVOKE DELETE está em docs/mvp2/sql e **não** em supabase/migrations.
- O rollback que devolve DELETE ao cliente reabre o risco de cascata; preferir corrigir o cliente mantendo o bloqueio.

Referências: PR #60, PR #62, issues #58 e #61.
