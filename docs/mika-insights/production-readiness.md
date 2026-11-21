# MIKA Insights — preparação de produção (sem deploy automático)

## Estado verificado em 2026-11-21
- Código integrado à branch `feat/mika-insights-myryra-integration` sobre a base MYRYRA Universe.
- CI: MIKA Insights integration checks, MYRYRA regression checks e MVP1 Quality and Security aprovados no commit `b89d4a9`.
- Preview Vercel READY; o Preview usa o projeto Supabase isolado `xanavauqzsrgvdfhcrsm`.
- Supabase produção `qothgddrvrpeqsprslqk`: `public.mika_ideas`, `public.mika_action_proposals`, `public.mika_action_audit` e `mika_internal.ai_quota` ausentes (consulta somente leitura).
- Erro de autenticação observado em homologação: `captcha protection: request disallowed (sitekey-secret-mismatch)`.

## Plano de correção
1. Alinhar sitekey hCaptcha da aplicação Preview com a secret configurada no Supabase Auth Preview. Usar par próprio de homologação, nunca reutilizar segredo de produção; não desabilitar proteção.
2. Testar login, sessão e navegação autenticada em desktop e Android.
3. Executar testes E2E de CRUD, voz e sugestão de plano, inclusive isolamento entre usuários, concorrência, limites de IA e erros HTTP.
4. Revisar `schema-proposal.sql` e `ai-quota-preview.sql`, adaptar como migrações versionadas, validar em Preview e obter aprovação para aplicar em produção. A interface inicial de Insights usa `mika_ideas` e a API usa `mika_consume_ai_quota`; não instalar funções da MIKA Agente sem revisão específica.
5. Confirmar variáveis de ambiente e flags de cobrança da build de produção. **Não promover um deployment Preview com Supabase Preview embutido**; construir deployment de produção a partir do código aprovado e das variáveis Production.
6. Executar smoke tests de produção, monitorar logs e ter rollback do código preparado. Reverter DDL somente após avaliar dados criados por usuários, sem `DROP TABLE` automático.

## Auditoria de permissões no Supabase Preview (2026-11-21)
- `mika_ideas`: RLS ativo, quatro políticas.
- `mika_action_proposals` e `mika_action_audit`: RLS ativo, uma política cada.
- `mika_internal.ai_quota`: RLS **ativado em Preview** em 2026-11-21; schema privado, `anon` e `authenticated` sem SELECT e zero políticas (acesso direto negado). Migração registrada no SQL de quotas. Falta teste funcional autenticado da RPC após a alteração.
- As funções `mika_consume_ai_quota`, `mika_decide_proposal` e `mika_execute_approved_task` não concedem EXECUTE a `anon`; `authenticated` tem EXECUTE. Revisão de SECURITY DEFINER e ownership ainda necessária.

## Critérios de aceite
- Login e CAPTCHA funcionam; sessões não são compartilhadas entre ambientes.
- RLS restringe acesso ao proprietário; `anon` não acessa ideias.
- Quotas de IA verificadas; não há uso de service role no navegador.
- Operações de ideias e sugestões persistem e sobrevivem ao reload.
- Nenhum pagamento real habilitado pela entrega.
- PR #66 revisado e aprovado antes do merge/deploy.

**Estado atual: NÃO APTO para publicação.** Este documento não autoriza nem executa alterações no Supabase de produção.

## Supabase Security Advisor — 2026-11-21
- INFO `rls_enabled_no_policy` na tabela privada `mika_internal.ai_quota`: esperado como **deny-all** para acesso direto. Sem grants de SELECT para anon/authenticated. Acesso via função autenticada exige teste funcional.
- WARN `authenticated_security_definer_function_executable` em três RPCs públicas. A exposição a authenticated é intencional para o fluxo atual, mas exige revisão de código, `auth.uid()`, ownership, limites, search_path e auditoria antes de PROD. Não remover grants sem avaliar chamadas da aplicação.
- WARN `auth_leaked_password_protection`: proteção de senhas vazadas desativada no Supabase Preview. Configuração de Auth deve ser revisada no painel.
- Remediações: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy ; https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable ; https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Revisão de código das três RPCs SECURITY DEFINER (2026-11-21)
Definições inspecionadas diretamente no banco Preview, sem executar ações em dados de usuários:
- `mika_consume_ai_quota`: `auth.uid()` obrigatório; aceita apenas `suggest` (12/h) e `transcribe` (20/h); `INSERT ... ON CONFLICT ... WHERE` atômico para limite; `search_path=''`; tabela interna privada. Requer teste concorrente autenticado depois da correção de CAPTCHA.
- `mika_decide_proposal`: exige `auth.uid()`, consulta proposta por `id` e `user_id` com `FOR UPDATE`, exige `pending`, trata expiração, registra auditoria e aprovação/rejeição. Requer teste de usuário diferente e repetição.
- `mika_execute_approved_task`: exige `auth.uid()`, bloqueia proposta por proprietário, exige status `approved` e ação `create_task`, valida expiração, plano e título, grava tarefa com `user_id` do token e audita; segunda chamada retorna `already_executed` após conferir plano. Requer teste de concorrência, payload malformado e regressão da tabela `tasks`.
- **Risco de publicação:** o código atual da página MIKA Insights não chama as duas RPCs de execução da MIKA Agente; não implantar essas funções em produção apenas por fazerem parte do Preview. Aplicar princípio do menor privilégio e migrar só os componentes efetivamente utilizados na primeira entrega.
- As três funções usam `SECURITY DEFINER` e `search_path=''`. Revisão estática não equivale a teste funcional autenticado ou auditoria independente.
