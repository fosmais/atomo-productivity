# MYRYRA Finance — roteiro de aceite funcional (Preview isolado)

**Ambiente:** branch `test/mvp2-finance-wallet-regression`, Supabase staging `xanavauqzsrgvdfhcrsm`. Não executar em PROD.

## Pré-condições
- Confirmar URL Preview associada ao último commit e autenticação permitida.
- Utilizar duas contas de teste distintas (A e B), sem dados pessoais reais.
- Manter checkout, entitlements e cobranças reais desabilitados.
- Registrar evidência com data, usuário de teste anonimizado, resultado esperado/obtido e captura sem dados sensíveis.

## Casos de aceite
| ID | Cenário | Resultado esperado |
|---|---|---|
| FIN-01 | A registra saldo inicial e recarrega a página | Saldo salvo e persistente, sem duplicação |
| FIN-02 | A cadastra receita e despesa | Lançamentos aparecem com valores, datas e categorias corretos |
| FIN-03 | A edita lançamento e recarrega | Alteração persiste e totais são recalculados |
| FIN-04 | A exclui lançamento (lixeira) | Item deixa de constar na visão ativa sem perda definitiva |
| FIN-05 | A restaura lançamento excluído | Item retorna uma única vez e totais são recalculados |
| FIN-06 | A cadastra meta financeira e despesa planejada | Dados persistem após sair e entrar |
| FIN-07 | A cadastra assinatura recorrente | Assinatura e valores persistem sem duplicação |
| FIN-08 | A usa alerta de saldo negativo | Aviso e encaminhamento para MIKA aparecem quando aplicável |
| FIN-09 | B entra após A e acessa Finance | Nenhum dado de A aparece na conta B |
| FIN-10 | B tenta abrir/alterar ID de lançamento de A por chamada autenticada | API nega acesso; dado de A não muda |
| FIN-11 | A sai e entra novamente | Todos os dados ativos e restaurados continuam consistentes |
| FIN-12 | Testar no viewport mobile | Campos, botões, modais e navegação utilizáveis |

## Critérios de bloqueio
- Qualquer vazamento entre contas, perda/duplicação de dados, falha de persistência, erro de autenticação ou cobrança real bloqueia aprovação.
- Evidência de SQL/RLS ou CI não substitui testes da interface autenticada.
- Antes de qualquer promoção, obter autorização separada para migrações de esquema em PROD e para deploy.
- Não promover automaticamente esta branch ou os scripts de `docs/sql/staging-migrations/`.

## Registro de execução
Marcar cada caso como **Pendente**, **Aprovado** ou **Reprovado**, com evidência. **Todos começam Pendentes**; este documento não representa execução de E2E.
