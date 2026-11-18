# Issue #61 — Inventário da tabela de exercícios atribuídos

> Documento de reconciliação, **não** migração executável. Fonte: consultas read-only no staging `xanavauqzsrgvdfhcrsm` em 18/11/2026. Não aplicar diretamente em PROD.

## Colunas observadas

| Coluna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | não | gen_random_uuid() |
| mission_id | uuid | não | — |
| owner_id | uuid | não | — |
| session_id | uuid | sim | — |
| version | integer | não | — |
| exercise | text | não | — |
| created_at | timestamptz | não | now() |

## Restrições

- PK(id); UNIQUE(mission_id,version)
- FK mission_id -> public.myryra_journey_missions(id) ON DELETE CASCADE
- FK owner_id -> auth.users(id) ON DELETE CASCADE
- FK session_id -> public.mika_teacher_sessions(id) ON DELETE SET NULL
- CHECK(version > 0); CHECK(char_length(btrim(exercise)) BETWEEN 10 AND 600)
- Índice adicional `myryra_assigned_exercises_owner_mission_idx` em `(owner_id, mission_id, version DESC)`

## Segurança observada

- RLS habilitada (FORCE RLS desabilitado).
- Política SELECT `Owner reads assigned exercises`: owner_id=auth.uid() e missão pertence a jornada do mesmo owner.
- ACL observada: `postgres=arwdDxtm`, `service_role=Dxtm`, `authenticated=r`; nenhuma permissão para anon. **Não assumir que bypass RLS confere privilégios SQL de escrita.**
- Trigger `myryra_validate_assigned_exercise` BEFORE INSERT OR UPDATE: função `public.myryra_validate_assigned_exercise()` SECURITY DEFINER, search_path vazio. Bloqueia UPDATE (exercícios imutáveis); INSERT verifica owner da missão e, quando session_id existe, mesmo owner, missão e jornada da sessão.

## Bloqueios antes de criar/aplicar migração

1. Confirmar o fluxo de emissão e como o backend insere exercícios oficiais; verificar papel de conexão e grants mínimos.
2. Validar a integridade e a compatibilidade da função de guard da conclusão da missão com `assessed_exercise_id`, `version` e `learning_progress`.
3. Preparar DDL idempotente com preflight e rollback documentado; **não** sobrescrever funções existentes em staging sem diff semântico.
4. Testar no staging com contas autenticadas distintas: owner e não-owner, exercício novo e versão antiga, sessão divergente, tentativa de UPDATE, aprovação/reprovação e MYRA sem duplicação.
5. Resolver drift e gate de rollout antes de merge/deploy. PR #60 continua candidata, não autorizada para PROD.

Este inventário registra evidências observadas; não afirma que as permissões atuais sejam suficientes nem que o fluxo esteja homologado.
