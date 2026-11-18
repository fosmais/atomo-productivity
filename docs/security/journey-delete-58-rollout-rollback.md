# Issue #58 — Plano de aplicação e reversão (somente revisão)

**Não executar automaticamente.** O SQL abaixo é um procedimento de contingência, **não** uma migration e **não** foi aplicado em nenhum ambiente.

## Estado de referência observado em PROD (18/11/2026)
- `authenticated` possui `DELETE` e `UPDATE` na tabela `public.myryra_journeys`.
- A policy `journeys_delete_owner` tem comando `DELETE`, papel `authenticated` e expressão `(( SELECT auth.uid() AS uid) = owner_id)`.
- `postgres` e `service_role` também possuem `DELETE`.
- A FK do ledger MYRA em PROD utiliza `ON DELETE CASCADE`; restaurar `DELETE` pode reabrir o risco de perda de histórico.

## Gates antes de aplicar a proteção
1. Confirmar todos os consumidores da tabela, incluindo mobile e clientes legados.
2. Testar a integração PR #60 com duas contas Auth reais, permissões e histórico MYRA.
3. Ensaiar a migração em clone isolado com grants e policy equivalentes a PROD.
4. Revisar transações e backups, monitoramento e janela de implantação.
5. Obter aprovação explícita de mudança de produção.

## Validação pós-aplicação (read-only)
```sql
SELECT has_table_privilege('authenticated','public.myryra_journeys','DELETE') AS authenticated_can_delete;
SELECT EXISTS (
  SELECT 1 FROM pg_policies
  WHERE schemaname='public' AND tablename='myryra_journeys'
    AND policyname='journeys_delete_owner'
) AS owner_delete_policy_exists;
```
Ambos os resultados devem ser `false`.

## Rollback de emergência — **somente mediante aprovação explícita**
**Atenção:** restaura uma capacidade perigosa de exclusão física; preferir corrigir clientes incompatíveis mantendo a proteção. Se a reversão for inevitável, executar em transação supervisionada, após revisão do estado real das policies:

```sql
BEGIN;
GRANT DELETE ON TABLE public.myryra_journeys TO authenticated;
CREATE POLICY journeys_delete_owner
  ON public.myryra_journeys
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = owner_id);
COMMIT;
```

Não executar se a policy já existir ou tiver sido substituída por outra. Após qualquer rollback, verificar as permissões efetivas e abrir ação urgente para restaurar a proteção.

## Observações
- O rollback **não** recupera registros MYRA já excluídos por cascata.
- O script não modifica `UPDATE`; esse risco deve ser tratado separadamente.
- Não há comprovação de E2E autenticado no staging até existirem contas de teste.
