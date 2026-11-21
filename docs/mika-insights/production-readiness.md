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

## Critérios de aceite
- Login e CAPTCHA funcionam; sessões não são compartilhadas entre ambientes.
- RLS restringe acesso ao proprietário; `anon` não acessa ideias.
- Quotas de IA verificadas; não há uso de service role no navegador.
- Operações de ideias e sugestões persistem e sobrevivem ao reload.
- Nenhum pagamento real habilitado pela entrega.
- PR #66 revisado e aprovado antes do merge/deploy.

**Estado atual: NÃO APTO para publicação.** Este documento não autoriza nem executa alterações no Supabase de produção.
