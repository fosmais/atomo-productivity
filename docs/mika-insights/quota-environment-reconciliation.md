# MIKA Insights — reconciliação de cotas entre ambientes

Verificado em 2026-11-22 por consultas somente leitura aos bancos Supabase.

| Aspecto | Homologação | Production |
| --- | --- | --- |
| Coluna do contador | `requests` | `usage_count` |
| Chave primária | `(user_id, action)` | `(user_id, action, window_start)` |
| Janela | 1 hora móvel por usuário e ação | hora-calendário por usuário e ação |
| Função | `public.mika_consume_ai_quota(text)` | `public.mika_consume_ai_quota(text)` |

## Restrições de segurança
- Não aplicar `20261121033400_mika_insights_core_schema_and_quota.sql` diretamente em Production: a migração versionada corresponde à homologação.
- Não trocar nomes de colunas, chaves ou semântica de janelas sem plano de migração e testes de regressão.
- Não apagar cotas existentes nem recriar a tabela de Production.
- Não promover a branch de MIKA Insights para `main`: a branch principal contém outra versão da aplicação.
- Validar autenticação real, isolamento entre dois usuários, concorrência e chamadas OpenAI antes de liberar o recurso.

## Próximos passos
1. Registrar qual implementação de janela é a especificação desejada do produto.
2. Criar migração incremental idempotente, com preflight de esquema e dados e plano de reversão, somente após escolher a semântica.
3. Exercitar limites de 12 sugestões e 20 transcrições, renovação da janela e simultaneidade em ambiente isolado.
4. Confirmar CI e testes E2E com login hCaptcha em Preview.
5. Manter Production inalterada até os critérios de aceite serem comprovados.
