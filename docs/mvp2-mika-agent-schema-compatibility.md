# MIKA MVP2 — compatibilidade com o esquema de homologação

## Inventário confirmado (branch myryra-mvp2-finance-homolog)

O esquema ativo **não** corresponde ao rascunho em `docs/sql/mika-agent-staging-proposals.sql`.
Não aplicar aquele rascunho sobre as tabelas existentes: `CREATE TABLE IF NOT EXISTS`
não adiciona colunas ausentes nem harmoniza restrições.

| Atual no banco | Novo rascunho | Decisão |
| --- | --- | --- |
| `action_type` | `kind` | Preservar `action_type` |
| `pending`, `approved`, `executing`, `executed`, `rejected`, `failed`, `expired` | `proposed`, `approved`, `executing`, `succeeded`, `failed`, `rejected`, `expired` | Adaptar o motor aos estados existentes |
| `event_type` na auditoria | `transition` | Preservar `event_type` |
| `result` jsonb | `result_ref` | Preservar `result` |
| `execution_key` uuid UNIQUE | digest SHA-256 | Não reutilizar `execution_key` como digest; projetar coluna própria se necessária |

## Proteções existentes

- RLS nas duas tabelas; leitura restrita a `auth.uid() = user_id`.
- RPCs `mika_decide_proposal` e `mika_execute_approved_task` são SECURITY DEFINER, executáveis por `authenticated`, não por `anon`.
- Execução usa `SELECT ... FOR UPDATE` e retorno idempotente quando já executada.
- Correção **aplicada somente à homologação** em 09/11/2026: `mika_execute_approved_task` exige `payload.plan_id` correspondente ao parâmetro, e verifica `expires_at` antes de criar tarefa.

## Bloqueadores de produção

1. Persistir a correção aplicada na homologação em migração versionada, após capturar a definição real da função e dependências.
2. Revisar SECURITY DEFINER e privilégios das duas RPCs; há alertas de segurança no advisor.
3. Confirmar que o backend gera proposta imutável e inclui `plan_id` no payload **antes** da aprovação. A nova validação rejeita propostas antigas sem esse campo.
4. Testar com dois JWTs reais de homologação: proprietário, outro usuário, expiração, rejeição, replay, concorrência e auditoria. Não usar usuários de PROD.
5. Resolver `MIGRATIONS_FAILED` da branch; verificar a reconciliação de histórico antes de merge.
6. Confirmar CI de regressão, qualidade, build e auditoria de dependências.
7. Verificar integração ponta a ponta e publicar somente após homologação e autorização de release.

**Não executar o SQL de staging como migração de produção.** Este documento é inventário e plano de compatibilidade, não autorização de deploy.
