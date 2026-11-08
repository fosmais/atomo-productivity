# MYRYRA MVP2 — inventário Finance e critérios de homologação

Atualizado após inspeções somente leitura do Supabase principal e migrações executadas **exclusivamente** no projeto isolado `xanavauqzsrgvdfhcrsm`.

## Cobertura estrutural
- 9/9 tabelas Finance de produção presentes na homologação.
- 63/63 colunas de produção correspondentes em nome, tipo, nulidade e padrão.
- Duas colunas adicionais `deleted_at` somente em homologação: lançamentos e assinaturas.
- 42/42 constraints correspondentes.
- 26/26 políticas RLS de produção correspondentes; duas políticas UPDATE adicionais para testar edição e lixeira.
- 18/18 índices de produção presentes; três índices adicionais de homologação.

## Segurança e testes já executados
- Testes SQL transacionais com dois usuários para as nove tabelas: operações autorizadas e bloqueio de acessos cruzados aprovados; fixtures revertidas com ROLLBACK.
- Script reproduzível para lançamentos e assinaturas: `docs/sql/mvp2-finance-staging-rls-regression.sql`.
- Script reproduzível para receitas, preferências, notificações e entregas: `docs/sql/mvp2-finance-notifications-rls-regression.sql`.
- Scripts aplicados diretamente ao Supabase staging ainda precisam ser consolidados em migrações de código-fonte antes da promoção.

## Preview
- Vercel deployment `dpl_2gzHqwFyvtTn5yH6dNorFc1mPx1d`, commit `f6d57adce904235fa4d29a1afa674285d36c1f8d`, estado READY.
- URL: https://atomo-productivity-10uyhquii-fosmais.vercel.app
- Vercel SSO habilitado para Preview; READY não equivale a validação de login ou E2E.
- Autenticação, salvar/editar/excluir/restaurar, persistência e UI mobile: **pendentes**.

## Gates antes de produção
1. Consolidar migrações SQL de homologação em arquivos versionados e conferir ordem de aplicação.
2. Testar autenticação e fluxos financeiros no Preview com usuários de teste, sem dados reais.
3. Verificar lixeira e consultas de resumo/fluxo de caixa com `NEXT_PUBLIC_MYRYRA_FINANCE_TRASH_ENABLED` controlada.
4. CI/build e regressão ponta a ponta aprovados; revisar diff do PR.
5. Manter pagamentos reais desabilitados e não promover alterações sem validação explícita.

**Não alterar Supabase principal, nem variáveis globais Preview, nem fazer deploy em PROD nesta fase.**
