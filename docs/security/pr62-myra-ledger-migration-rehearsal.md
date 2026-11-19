# PR #62 — Plano de ensaio da migração MYRA (não executar em PROD)

**Estado:** somente documentação. Nenhuma migration foi aplicada ou autorizada.

## Fonte revisada
`supabase/migrations/20261115000200_preserve_myra_history.sql` na branch `feat/mvp2-professora-journey-myra-26`.

## Diferença de ambiente verificada em 19/11/2026
| Controle | Homologação | Produção |
|---|---|---|
| authenticated DELETE jornada | false | true |
| authenticated UPDATE jornada | false | true |
| service_role UPDATE jornada | true | true |
| ledger jornada/mission FK | ON DELETE SET NULL | ON DELETE CASCADE |

## Pré-checagens somente leitura
```sql
SELECT count(*) AS credits, count(DISTINCT mission_id) AS distinct_missions,
       count(*) FILTER (WHERE mission_id IS NULL) AS missing_mission,
       count(*) FILTER (WHERE journey_id IS NULL) AS missing_journey
FROM public.myryra_journey_myra_ledger;

SELECT mission_id, count(*) FROM public.myryra_journey_myra_ledger
GROUP BY mission_id HAVING count(*) > 1;

SELECT column_name,is_nullable,data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='myryra_journey_myra_ledger'
ORDER BY ordinal_position;

SELECT conname,pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid='public.myryra_journey_myra_ledger'::regclass;
```

## Ensaio em clone isolado, sujeito à autorização
1. Capturar snapshot de contagem, soma de créditos, hashes/IDs e grants; confirmar backup e ponto de restauração.
2. Revisar dependências de `mission_id`, `source_mission_id` e função `myryra_credit_completed_mission()`. A migration altera uma função SECURITY DEFINER: verificar ownership, privilégios EXECUTE, search_path e gatilhos.
3. Executar migração em clone descartável com dados equivalentes a PROD; confirmar backfill completo de `source_mission_id`, UNIQUE, FKs SET NULL e manutenção da FK de owner para LGPD.
4. Repetir conclusão da mesma missão: nenhum crédito adicional. Concluir missão diferente: um crédito novo.
5. Arquivar jornada: linhas do ledger e saldo não mudam. Simular exclusão física **apenas no clone**: ledger mantém crédito e source_mission_id.
6. Validar isolamento entre dois usuários Auth, MFA/aceite, web/mobile e cliente legado; tentar DELETE direto, editar, pausar, retomar e arquivar.
7. Conferir integridade, plano de reversão sem reabrir DELETE perigoso, observabilidade e janela de implantação.

## Bloqueios de produção
- PROD ainda permite DELETE autenticado e possui FKs CASCADE.
- A migration de preservação não foi validada em clone equivalente a PROD.
- Não há evidência de E2E de duas contas autenticadas.
- Não aplicar SQL, migration, merge ou deploy sem aprovação explícita.
