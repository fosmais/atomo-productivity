# MIKA Insights — homologação MVP2

Ambiente: Preview da branch `feat/mika-insights-mvp2` conectado exclusivamente ao Supabase de homologação `xanavauqzsrgvdfhcrsm`.

## Pré-condições
- Login de duas contas de teste distintas no Preview.
- `OPENAI_API_KEY` configurada para Preview.
- Nunca usar dados de produção ou pagamentos reais.
- A tabela `public.mika_ideas` deve ter RLS habilitada.

## Cenários de aceite (marcar somente após execução)
- [ ] Conta A registra ideia; data/hora e conteúdo persistem após recarregar.
- [ ] Conta A pesquisa, edita, arquiva, restaura e exclui a ideia.
- [ ] Ao editar/arquivar/restaurar/excluir, sugestão anterior deixa de aparecer.
- [ ] Conta A solicita plano; até oito sugestões são exibidas, sem criar tarefas.
- [ ] Falha de IA retorna erro compreensível e não altera ideias.
- [ ] Conta B não visualiza nem altera as ideias da conta A.
- [ ] POST sem login em `/api/mika-insights/suggest` com UUID válido retorna HTTP 401.
- [ ] POST com login B e UUID de ideia da conta A retorna HTTP 404, sem conteúdo.
- [ ] POST com `ideaId` inválido retorna HTTP 400.
- [ ] POST com Content-Type diferente de JSON retorna HTTP 415.
- [ ] Verificar comportamento no Android e em tela estreita.
- [ ] Conferir logs de Preview após os testes, sem dados sensíveis.

## Comportamento esperado
A geração é apenas uma proposta efêmera, não grava `proposed_plan`, não cria tarefas, não agenda compromissos e não altera a Journey. A aprovação/execução de um plano exige uma futura implementação específica e autorização explícita do usuário.

## Evidências
Registrar aqui: data, commit, deployment, conta de teste pseudonimizada, resultado de cada cenário e defeitos identificados. **Build READY não substitui teste funcional.**

## Liberação
Não realizar merge na `main` nem publicar em produção enquanto cenários críticos não estiverem aprovados.
