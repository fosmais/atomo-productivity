# Issue #61 — Contrato proposto: emissão e avaliação de exercício oficial

**Status:** especificação para revisão, não implementada. Nenhuma autorização de deploy ou DDL. Depende de reconciliar schema/grants em staging e PROD.

## Problema verificado na PR #60

- `POST /api/mika/lessons/sessions` cria sessão vinculada opcionalmente à missão; não registra exercício atribuído.
- `POST /api/journeys/feedback` recebe `exercise` do cliente e avalia esse texto sem validar um identificador de exercício oficial/versionado.
- O guard de conclusão presente em staging considera a versão oficial atribuída e evidência de avaliação vinculada. Logo, avaliação e conclusão podem divergir.

## Contrato alvo (proposta)

1. Após autenticação, MFA e aceite legal aplicável, o servidor confirma owner de jornada, missão e sessão opcional.
2. A emissão de exercício oficial usa backend confiável, gera versão monotônica por missão e grava registro imutável em `myryra_journey_assigned_exercises`; impedir escrita direta do cliente. Tratar concorrência por UNIQUE(mission_id,version) com retry controlado.
3. A resposta de emissão retorna `exerciseId`, `version` e `exercise` da linha persistida. Não confiar em texto do exercício reenviado pelo cliente.
4. O pedido de avaliação referencia `exerciseId` e versão. O servidor busca exercício por owner/mission/session e verifica que é a versão mais recente; rejeita versão antiga ou vínculo divergente (409/404), sem chamar IA.
5. Persistir evidência de avaliação vinculada ao exercício oficial na estrutura de `learning_progress` **após confirmar colunas e constraints reais**; usar compare-and-set para não substituir resposta alterada durante a chamada IA.
6. A conclusão de missão exige avaliação aprovada vinculada à versão oficial vigente, inclusive no guard do banco; crédito MYRA idempotente.
7. Não expor chave administrativa ao cliente. Revisar `service_role` ACL observada em staging antes de definir grants mínimos ou RPC com SECURITY DEFINER auditada.

## Cenários obrigatórios antes de liberar

- Owner emite e avalia exercício atual; usuário B não consegue ler/avaliar o exercício do owner A.
- Sessão de outra missão ou jornada é rejeitada.
- Tentativa de editar exercício oficial é rejeitada; nova versão preserva histórico.
- Avaliação de versão antiga é rejeitada sem chamada IA ou crédito MYRA.
- Resposta alterada enquanto IA processa resulta em conflito sem gravar avaliação obsoleta.
- Nota abaixo da mínima impede conclusão; nota suficiente permite apenas uma recompensa, inclusive com retries.
- Falta de tabela, grants, migração ou evidência falha de modo seguro; não promover PR #60.

## Gate de release

Somente após migrações reconciliadas, grants revisados, testes automatizados e E2E com duas contas autenticadas. Manter pagamentos reais desabilitados e nenhuma alteração em PROD até aprovação explícita.
