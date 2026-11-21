# MIKA — ativação controlada do console de staging

Escopo: **somente** Preview da branch `feat/mvp2-professora-journey-myra-26`. Não promover para produção.

## Pré-requisitos

1. Confirmar que o Preview usa o projeto Supabase dedicado `xanavauqzsrgvdfhcrsm`. Configurar **juntos** `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` correspondentes a esse projeto. Nunca trocar apenas uma das variáveis.
2. Validar login e MFA do administrador de testes nesse mesmo projeto. O usuário deve possuir `app_metadata.role = admin` e o ID deve constar da lista explícita `MYRYRA_STAGING_TEST_ADMIN_IDS`. Não conceder papel de administrador a usuários comuns.
3. Criar token GitHub de escopo mínimo para `fosmais/atomo-productivity`, com permissão **Actions: read/write** apenas quando necessária ao despacho do workflow. Guardá-lo somente em `MYRYRA_STAGING_GITHUB_TOKEN`, variável de servidor do Preview restrita à branch. Nunca usar prefixo `NEXT_PUBLIC_`.
4. No GitHub Actions, configurar o environment `staging` e os cinco secrets `MIKA_STAGING_ANON_KEY`, `MIKA_TEST_EMAIL`, `MIKA_TEST_PASSWORD`, `MIKA_TEST_OTHER_EMAIL`, `MIKA_TEST_OTHER_PASSWORD`. Usar duas identidades sintéticas `mika-staging-test...@` e senhas fortes; não reutilizar contas de produção.
5. Somente após as verificações anteriores, mudar `MYRYRA_STAGING_TEST_CONSOLE_ENABLED` de `false` para `true` no Preview **dessa branch** e gerar novo deployment Preview.

## Homologação

1. Entrar como administrador autorizado no Preview e abrir `/internal/staging-bootstrap`.
2. Clicar em **Verificar configuração**. O endpoint deve responder 404 a usuários não autorizados ou quando o ambiente não for staging.
3. Clicar em **Preparar duas contas de teste**. O endpoint despacha exclusivamente `journey-auth-staging.yml` na branch fixa, com `bootstrap_synthetic_accounts=true` e `run_mika_concurrency=false`.
4. Consultar as execuções. O retorno 202 significa apenas que o GitHub aceitou o despacho; **não** significa que o bootstrap terminou. Confirmar resultado do workflow e duas identidades distintas no Supabase de staging.
5. Se houver exigência de confirmação de e-mail, confirmar ambas as identidades e executar novamente. Não criar fixtures de Journey nem executar testes de concorrência até validar as contas.

## Reversão

Alterar `MYRYRA_STAGING_TEST_CONSOLE_ENABLED=false` na branch e gerar novo Preview. Revogar o token GitHub se houver suspeita de exposição. Não alterar variáveis de Production.

## Critérios de aprovação

- CI e build do commit aprovados;
- Preview conectado ao Supabase de staging;
- acesso negado a não administradores e fora de Preview;
- workflow executado com sucesso e duas contas sintéticas distintas;
- nenhuma alteração em PROD, pagamentos reais ou dados de usuários reais.
